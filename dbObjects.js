const Sequelize = require('sequelize');

const sequelize = new Sequelize('database', 'username', 'password', {
	host: 'localhost',
	dialect: 'sqlite',
	logging: false,
	storage: 'database.sqlite',
});

const Accounts = sequelize.import('models/Accounts');
const Characters = sequelize.import('models/characters');

// Characters.belongsTo(Accounts);

module.exports = { Accounts, Characters };