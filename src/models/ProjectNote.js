module.exports = (sequelize, DataTypes) => {
    const ProjectNote = sequelize.define('ProjectNote', {
        content: { type: DataTypes.TEXT, allowNull: false }
    });

    ProjectNote.associate = (models) => {
        ProjectNote.belongsTo(models.Project, { foreignKey: 'projectId', as: 'Project' });
        ProjectNote.belongsTo(models.User, { foreignKey: 'userId', as: 'Author' });
    };
    return ProjectNote;
};