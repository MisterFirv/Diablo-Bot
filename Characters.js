module.exports = (sequelize, DataTypes) => {
	return sequelize.define('characters', {
		battleTag: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		character_name: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		character_id: {
			type: DataTypes.STRING,
			allowNull: false,
			unique: true,
		},
		class: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		highestSoloRiftCompleted: {
			type: DataTypes.INTEGER,
			allowNull: false,
		},
		alive: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			default: true,
		},
	});
};