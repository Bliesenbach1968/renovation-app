const Project = require('../models/Project');

/**
 * Generiert eine eindeutige Projektnummer im Format PRJ-YYYY-NNNN
 */
const generateProjectNumber = async () => {
  const year = new Date().getFullYear();
  const prefix = `PRJ-${year}-`;

  // Letzte Projektnummer dieses Jahres finden
  const lastProject = await Project.findOne(
    { projectNumber: { $regex: `^${prefix}` } },
    { projectNumber: 1 },
    { sort: { projectNumber: -1 } }
  );

  let nextNum = 1;
  if (lastProject) {
    const lastNum = parseInt(lastProject.projectNumber.split('-')[2], 10);
    nextNum = lastNum + 1;
  }

  return `${prefix}${String(nextNum).padStart(4, '0')}`;
};

module.exports = { generateProjectNumber };
