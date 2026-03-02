#!/bin/bash
# API Test Suite - Renovation App
set +H

PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "  OK  $1"; }
fail() { FAIL=$((FAIL+1)); echo " FAIL $1 (got $2, expected $3)"; }
check() { [ "$2" = "$3" ] && ok "$1" || fail "$1" "$2" "$3"; }

# Login via heredoc (avoids ! history expansion)
cat > /tmp/login_renovapp.json << 'LOGINEOF'
{"email":"admin@sanierung.de","password":"Admin1234!"}
LOGINEOF
TOKEN=$(curl -s -X POST http://localhost/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d @/tmp/login_renovapp.json \
  | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then echo "LOGIN FEHLGESCHLAGEN"; exit 1; fi
echo "Login OK (${#TOKEN} chars)"
echo ""

echo "=== Auth ==="
check "GET /auth/me" \
  "$(curl -s -o /dev/null -w '%{http_code}' http://localhost/api/v1/auth/me -H "Authorization: Bearer $TOKEN")" 200
check "GET /auth/me (kein Token → 401)" \
  "$(curl -s -o /dev/null -w '%{http_code}' http://localhost/api/v1/auth/me)" 401

echo "=== Projekte ==="
PROJ=$(curl -s -X POST http://localhost/api/v1/projects \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Testagent Projekt","address":{"street":"Teststr. 1","zipCode":"10115","city":"Berlin"},"etagenOhneKeller":2}')
PID=$(echo "$PROJ" | grep -o '"_id":"[^"]*"' | tail -1 | cut -d'"' -f4)
check "POST /projects" "$([ -n "$PID" ] && echo 1 || echo 0)" 1
check "GET /projects" "$(curl -s -o /dev/null -w '%{http_code}' http://localhost/api/v1/projects -H "Authorization: Bearer $TOKEN")" 200
check "GET /projects/:id" "$(curl -s -o /dev/null -w '%{http_code}' "http://localhost/api/v1/projects/$PID" -H "Authorization: Bearer $TOKEN")" 200
check "PUT /projects/:id" "$(curl -s -o /dev/null -w '%{http_code}' -X PUT "http://localhost/api/v1/projects/$PID" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"description":"aktualisiert"}')" 200
check "GET /projects/:id/summary" "$(curl -s -o /dev/null -w '%{http_code}' "http://localhost/api/v1/projects/$PID/summary" -H "Authorization: Bearer $TOKEN")" 200
check "GET /projects/:id/timeline" "$(curl -s -o /dev/null -w '%{http_code}' "http://localhost/api/v1/projects/$PID/timeline" -H "Authorization: Bearer $TOKEN")" 200
check "GET /projects/:id/audit" "$(curl -s -o /dev/null -w '%{http_code}' "http://localhost/api/v1/projects/$PID/audit" -H "Authorization: Bearer $TOKEN")" 200

echo "=== Phasenstatus (NEU) ==="
PHASE_ID=$(curl -s -H "Authorization: Bearer $TOKEN" "http://localhost/api/v1/projects/$PID" \
  | grep -o '"phases":\[.*\]' | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
PATCH_R=$(curl -s -X PATCH "http://localhost/api/v1/projects/$PID/phases/$PHASE_ID" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"status":"active"}')
check "PATCH /phases/:id planned→active" "$(echo "$PATCH_R" | grep -o '"success":true' | wc -l | tr -d ' ')" 1
ENTK=$(echo "$PATCH_R" | grep -o '"geplantePhasensummeEntkernung":[0-9.]*' | cut -d: -f2)
GES=$(echo "$PATCH_R" | grep -o '"geplanteGesamtsummeProjekt":[0-9.]*' | cut -d: -f2)
check "  geplantePhasensummeEntkernung gespeichert" "$([ -n "$ENTK" ] && echo 1 || echo 0)" 1
check "  geplanteGesamtsummeProjekt gespeichert" "$([ -n "$GES" ] && echo 1 || echo 0)" 1
check "PATCH /phases/:id active→completed" "$(curl -s -o /dev/null -w '%{http_code}' \
  -X PATCH "http://localhost/api/v1/projects/$PID/phases/$PHASE_ID" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"status":"completed"}')" 200
check "PATCH /phases/:id 404 (unbekannte ID)" "$(curl -s -o /dev/null -w '%{http_code}' \
  -X PATCH "http://localhost/api/v1/projects/$PID/phases/000000000000000000000000" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"status":"active"}')" 404

echo "=== Etagen ==="
FID=$(curl -s -X POST "http://localhost/api/v1/projects/$PID/floors" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Testgeschoss","level":9,"order":9}' \
  | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
check "POST /floors" "$([ -n "$FID" ] && echo 1 || echo 0)" 1
check "GET /floors" "$(curl -s -o /dev/null -w '%{http_code}' "http://localhost/api/v1/projects/$PID/floors" -H "Authorization: Bearer $TOKEN")" 200
check "PUT /floors/:id" "$(curl -s -o /dev/null -w '%{http_code}' -X PUT "http://localhost/api/v1/projects/$PID/floors/$FID" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"name":"Geaendert"}')" 200

echo "=== Räume ==="
ROOM_BODY=$(printf '{"floorId":"%s","name":"Testraum","type":"other"}' "$FID")
RID=$(curl -s -X POST "http://localhost/api/v1/projects/$PID/rooms" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "$ROOM_BODY" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
check "POST /rooms" "$([ -n "$RID" ] && echo 1 || echo 0)" 1
check "GET /rooms" "$(curl -s -o /dev/null -w '%{http_code}' "http://localhost/api/v1/projects/$PID/rooms" -H "Authorization: Bearer $TOKEN")" 200
check "GET /rooms/:id" "$(curl -s -o /dev/null -w '%{http_code}' "http://localhost/api/v1/projects/$PID/rooms/$RID" -H "Authorization: Bearer $TOKEN")" 200
check "PUT /rooms/:id" "$(curl -s -o /dev/null -w '%{http_code}' -X PUT "http://localhost/api/v1/projects/$PID/rooms/$RID" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"name":"Aktualisiert"}')" 200

echo "=== Positionen ==="
# Write position JSON via heredoc (contains m² UTF-8), then inject roomId
cat > /tmp/pos_base.json << 'POSEOF'
{"name":"Testpos","category":"Boden","unit":"m²","quantity":10,"materialCostPerUnit":20,"disposalCostPerUnit":5,"laborHoursPerUnit":0.5,"laborHourlyRate":45,"phaseType":"demolition","roomId":"PLACEHOLDER"}
POSEOF
sed "s/PLACEHOLDER/$RID/" /tmp/pos_base.json > /tmp/pos_final.json
POSID=$(curl -s -X POST "http://localhost/api/v1/projects/$PID/positions" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d @/tmp/pos_final.json | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
check "POST /positions" "$([ -n "$POSID" ] && echo 1 || echo 0)" 1
check "GET /positions" "$(curl -s -o /dev/null -w '%{http_code}' "http://localhost/api/v1/projects/$PID/positions" -H "Authorization: Bearer $TOKEN")" 200
check "PUT /positions/:id" "$(curl -s -o /dev/null -w '%{http_code}' -X PUT "http://localhost/api/v1/projects/$PID/positions/$POSID" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"quantity":20}')" 200

echo "=== Container ==="
CID=$(curl -s -X POST "http://localhost/api/v1/projects/$PID/containers" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"phaseType":"demolition","type":"Bauschutt","sizeCubicMeters":7,"quantity":1,"pricePerContainer":400}' \
  | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
check "POST /containers" "$([ -n "$CID" ] && echo 1 || echo 0)" 1
check "GET /containers" "$(curl -s -o /dev/null -w '%{http_code}' "http://localhost/api/v1/projects/$PID/containers" -H "Authorization: Bearer $TOKEN")" 200
check "GET /containers/suggestion" "$(curl -s -o /dev/null -w '%{http_code}' "http://localhost/api/v1/projects/$PID/containers/suggestion" -H "Authorization: Bearer $TOKEN")" 200
check "PUT /containers/:id" "$(curl -s -o /dev/null -w '%{http_code}' -X PUT "http://localhost/api/v1/projects/$PID/containers/$CID" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"quantity":2}')" 200

echo "=== Gerüst ==="
GID=$(curl -s -X POST "http://localhost/api/v1/projects/$PID/geruest" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"phaseType":"renovation","type":"Sonstiges","areaSqm":200,"rentalWeeks":4,"pricePerSqmPerWeek":1.5,"assemblyDisassemblyCost":800}' \
  | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
check "POST /geruest" "$([ -n "$GID" ] && echo 1 || echo 0)" 1
check "GET /geruest" "$(curl -s -o /dev/null -w '%{http_code}' "http://localhost/api/v1/projects/$PID/geruest" -H "Authorization: Bearer $TOKEN")" 200
check "PUT /geruest/:id" "$(curl -s -o /dev/null -w '%{http_code}' -X PUT "http://localhost/api/v1/projects/$PID/geruest/$GID" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"rentalWeeks":6}')" 200

echo "=== Kran ==="
KID=$(curl -s -X POST "http://localhost/api/v1/projects/$PID/kran" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"phaseType":"specialConstruction","type":"Turmdrehkran","rentalDays":10,"pricePerDay":300,"operatorCostPerDay":200}' \
  | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
check "POST /kran" "$([ -n "$KID" ] && echo 1 || echo 0)" 1
check "GET /kran" "$(curl -s -o /dev/null -w '%{http_code}' "http://localhost/api/v1/projects/$PID/kran" -H "Authorization: Bearer $TOKEN")" 200
check "PUT /kran/:id" "$(curl -s -o /dev/null -w '%{http_code}' -X PUT "http://localhost/api/v1/projects/$PID/kran/$KID" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"rentalDays":15}')" 200

echo "=== Summary mit Daten ==="
check "GET /summary (mit Daten)" "$(curl -s -o /dev/null -w '%{http_code}' "http://localhost/api/v1/projects/$PID/summary" -H "Authorization: Bearer $TOKEN")" 200

echo "=== Phase aktivieren mit Daten ==="
# Zweite Phase (renovation) aktivieren – hat Gerüst-Daten (phaseType=renovation)
PHASE2_ID=$(curl -s -H "Authorization: Bearer $TOKEN" "http://localhost/api/v1/projects/$PID" \
  | grep -o '"phases":\[.*\]' | grep -o '"_id":"[^"]*"' | sed -n '2p' | cut -d'"' -f4)
PATCH3=$(curl -s -X PATCH "http://localhost/api/v1/projects/$PID/phases/$PHASE2_ID" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"status":"active"}')
RENOV=$(echo "$PATCH3" | grep -o '"geplantePhasensummeRenovierung":[0-9.]*' | cut -d: -f2)
GESAMT=$(echo "$PATCH3" | grep -o '"geplanteGesamtsummeProjekt":[0-9.]*' | cut -d: -f2)
check "PATCH planned→active (renovation): sum > 0 ($RENOV)" "$(awk "BEGIN{print ($RENOV+0 > 0)?1:0}")" 1
check "PATCH planned→active: geplanteGesamtsumme enthält renovation ($GESAMT)" "$(awk "BEGIN{print ($GESAMT+0 > 0)?1:0}")" 1

echo "=== Cleanup ==="
check "DELETE /positions/:id" "$(curl -s -o /dev/null -w '%{http_code}' -X DELETE "http://localhost/api/v1/projects/$PID/positions/$POSID" -H "Authorization: Bearer $TOKEN")" 200
check "DELETE /containers/:id" "$(curl -s -o /dev/null -w '%{http_code}' -X DELETE "http://localhost/api/v1/projects/$PID/containers/$CID" -H "Authorization: Bearer $TOKEN")" 200
check "DELETE /geruest/:id" "$(curl -s -o /dev/null -w '%{http_code}' -X DELETE "http://localhost/api/v1/projects/$PID/geruest/$GID" -H "Authorization: Bearer $TOKEN")" 200
check "DELETE /kran/:id" "$(curl -s -o /dev/null -w '%{http_code}' -X DELETE "http://localhost/api/v1/projects/$PID/kran/$KID" -H "Authorization: Bearer $TOKEN")" 200
check "DELETE /rooms/:id" "$(curl -s -o /dev/null -w '%{http_code}' -X DELETE "http://localhost/api/v1/projects/$PID/rooms/$RID" -H "Authorization: Bearer $TOKEN")" 200
check "DELETE /floors/:id" "$(curl -s -o /dev/null -w '%{http_code}' -X DELETE "http://localhost/api/v1/projects/$PID/floors/$FID" -H "Authorization: Bearer $TOKEN")" 200
check "DELETE /projects/:id (cleanup)" "$(curl -s -o /dev/null -w '%{http_code}' -X DELETE "http://localhost/api/v1/projects/$PID" -H "Authorization: Bearer $TOKEN")" 200

echo ""
echo "============================="
echo "ERGEBNIS: $PASS bestanden, $FAIL fehlgeschlagen"
[ $FAIL -eq 0 ] && exit 0 || exit 1
