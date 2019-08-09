module.exports = (sequelize, DataTypes) => {
	return sequelize.define('accounts', {
		battleTag: {
			type: DataTypes.STRING,
			primaryKey: true,
			unique: true,
		},
		nrOfDeathCharacters: {
			type: DataTypes.INTEGER,
			defaultValue: 0,
			allowNull: false,
		},
	}, {
		timestamps: false,
	});
};