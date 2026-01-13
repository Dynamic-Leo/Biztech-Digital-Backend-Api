module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define("User", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    fullName: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false, unique: true, validate: { isEmail: true } },
    password: { type: DataTypes.STRING, allowNull: false },
    role: { type: DataTypes.ENUM("Admin", "Agent", "Client"), allowNull: false },
    mobile: { type: DataTypes.STRING },
    status: { 
        type: DataTypes.ENUM('Pending Approval', 'Active', 'Rejected'),
        defaultValue: 'Pending Approval' 
    },

    emailVerificationToken: {
      type: DataTypes.STRING,
      allowNull: true
    },
    emailVerificationTokenExpiry: {
      type: DataTypes.DATE,
      allowNull: true
    },
    isEmailVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    resetPasswordToken: {
      type: DataTypes.STRING,
      allowNull: true
    },
    resetPasswordExpire: {
      type: DataTypes.DATE,
      allowNull: true
    }
  });

  User.associate = (models) => {
    User.hasOne(models.Client, { foreignKey: "userId", as: "ClientProfile" });
    User.hasMany(models.ServiceRequest, { foreignKey: 'agentId', as: 'AssignedRequests' });
    User.hasMany(models.Project, { foreignKey: 'agentId', as: 'ManagedProjects' });
  };
  return User;
};