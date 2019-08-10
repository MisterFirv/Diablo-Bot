const Discord = require('discord.js');
const axios = require('axios');
const { Accounts, Characters } = require('./dbObjects');
const { prefix, botToken, botChannelID, clientId, clientSecret } = require('./config.json');

const client = new Discord.Client();
client.commands = new Discord.Collection();
let channel, accesstoken;
let updateTimer;

let oauthExpiry;

client.on('ready', async () => {
	channel = client.channels.get(botChannelID);
	if(channel == null) return console.log(`Channel with ID: ${botChannelID} is invalid, please fix`);
	await updateAccessToken();
	console.log(`Logged in as ${client.user.tag} with accesstoken ${accesstoken}`);
	channel.send('Hello');
});

client.on('message', async message => {
	// Make sure we are listening in the right channel
	if(message.channel.id != botChannelID) return;
	// Make sure it starts with the prefix, not send by the bot
	if (!message.content.startsWith(prefix) || message.author.bot) return;


	const input = message.content.slice(prefix.length).trim();

	if (!input.length) return;
	const [, command, commandArgs] = input.match(/(\w+)\s*([\s\S]*)/);

	console.log(`Responding to command: ${command}.`);
	switch(command) {
	case 'ping': {
		if(message.author.tag === 'Cubby#2208') return message.reply('feck off');
		return message.reply('Pong!');
	}
	case 'add': {
		try {
			if (commandArgs.length != 1) return message.reply('you are going to have to supply a battletag you numpty');
			// equivalent to: INSERT INTO Accounts (battleTag, highest_rift, numberOfCharacters) values (?, ?, ?);
			const account = await Accounts.create({
				battleTag: commandArgs,
				highest_rift: 0,
				numberOfCharacters: 0,
			});
			insertCharacters(commandArgs);
			return message.reply(`Battletag ${account.battleTag} added.`);
		}
		catch (e) {
			if (e.name === 'SequelizeUniqueConstraintError') {
				return message.reply('That account already exists.');
			}
			return message.reply('Something went wrong with adding an account.');
		}
	}
	case 'showallAccounts': {
		// equivalent to: SELECT battleTag FROM Accounts;
		const accountList = await Accounts.findAll({ attributes: ['battleTag'] });
		const accountString = accountList.map(a => a.battleTag).join(', ') || 'No accounts set.';
		return message.channel.send(`List of accounts: ${accountString}`);
	}
	case 'update': {
		await update();
		return message.reply('Done with the update!');
	}
	case 'remove': {
		if (commandArgs.length != 1) return message.reply('you are going to have to supply a battletag you numpty');
		// equivalent to: DELETE from Accounts WHERE battleTag = ?;
		const rowCount = await Accounts.destroy({ where: { battleTag: commandArgs } });
		if (!rowCount) return message.reply('That battleTag did not exist.');

		return message.reply('battleTag deleted.');
	}
	case 'showcharacters': {
		if (commandArgs.length != 1) return message.reply('you are going to have to supply a battletag you numpty');
		// equivalent to: SELECT character_name FROM Characters WHERE battletag = ? & alive = true;
		const characterList = await Characters.findAll({ where: { battleTag: commandArgs, alive: true } });
		const characterString = characterList.map(c => c.character_name).join(', ') || 'No characters set.';
		return message.channel.send(`List of characters: ${characterString}`);
	}
	case 'showallcharacters': {
		// equivalent to: SELECT character_name FROM Characters;
		const characterList = await Characters.findAll({ attributes: ['character_name'] });
		const characterString = characterList.map(c => c.character_name).join(', ') || 'No characters set.';
		return message.channel.send(`List of characters: ${characterString}`);
	}
	case 'leaderboard': {
		// Select top 10 characters based on highest rift
		// equivalent to: SELECT battleTag, character_id FROM Characters;
		const characterList = await Characters.findAll({ order: [['highestSoloRiftCompleted', 'DESC']], limit: 10 });

		// Print characters with following format
		// Account - character name - rift level - alive
		let leaderboardString =
		'pos - Battletag	- Character	- class	- Highest Rift	- alive \n';
		let i = 1;
		characterList.forEach(c => {
			leaderboardString +=
			`${i}.  - ${c.battleTag}	- ${c.character_name}	- ${c.highestSoloRiftCompleted}	- ${c.alive} \n`;
			i++;
		});
		message.channel.send(leaderboardString);

		break;
	}
	case 'oauth': {
		updateAccessToken();
		break;
	}
	case 'token': {
		message.channel.send(`Accesstoken: ${accesstoken} , expires in: ${oauthExpiry}`);
		break;
	}
	case 'start': {
		if (updateTimer == null) {
			let time;
			if (commandArgs.length === 0) time = 60000;
			else time = commandArgs;
			message.channel.send(`starting timer with timer ${time}`);
			update();
			updateTimer = setInterval(update, time);
		}
		else {
			message.channel.send('Bot is already running');
		}
		break;
	}
	case 'stop': {
		if (updateTimer == null) {
			message.channel.send('No timer to stop');
		}
		else {
			clearInterval(updateTimer);
			updateTimer = null;
			message.channel.send('Timer stopped');
		}
		break;
	}
	}
});

const updateAccessToken = async () => {
	const url = `https://eu.battle.net/oauth/token?grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`;

	try {
		const response = await axios.get(url);
		accesstoken = response.data.access_token;
		oauthExpiry = response.data.expires_in;
		// set the timer
		// oauthTimer = setInterval(updateAccessToken, oauthExpiry * 1000);
	}
	catch (error) {
		console.log(error);
	}
};

const update = async () => {
	console.log('Updating');
	channel.send('Doing an update!');
	try {
		// Update all accounts
		await updateAccounts();
	}
	catch (error) {
		if(error.response.status === 401) {
			console.log('AccessToken invalid, requesting new one');
			channel.send('Invalid accesstoken detected, requesting a new one');
			await updateAccessToken();
			update();
			return;
		}
		else {
			return console.log(`updateAccounts had following error: ${error}`);
		}
	}

	try {
		// Update all characters
		await updateCharacters();
	}
	catch (error) {
		if(error.response.status === 401) {
			console.log('AccessToken invalid, requesting new one');
			channel.send('Invalid accesstoken detected, requesting a new one');
			await updateAccessToken();
			update();
			return;
		}
		else {
			console.log(`updateCharacters had following error: ${error}`);
		}
	}
	console.log('Done updating');
};

const updateAccounts = async () => {
	// equivalent to: SELECT battleTag FROM Accounts;
	const accountList = await Accounts.findAll({ attributes: ['battleTag'] });
	console.log(`number of accounts to update ${accountList.length}`);

	if(accountList.length == 0) return console.log('No accounts set');

	await Promise.all(accountList.map(async (account) => {
		await insertCharacters(account.battleTag);
	}
	)).catch((error) => {
		// If its a 401 error throw it down the chain
		if(error.response.status === 401) throw error;
		else console.log(`Somethign went wrong in updateAcounts: ${error}`);
	});

	/*
	// if we want to do it sequential instead of parralel
	for (const account of accountList) {
		await insertCharacters(account.battleTag);
	}*/
	// console.log('Done with updating accounts');
};

// Insert characters from a battleTag
const insertCharacters = async battleTag => {
	// const battleTag = account1.battleTag;
	// console.log(`inserting characters for account ${battleTag}`);
	const url = `https://EU.api.blizzard.com/d3/profile/${battleTag}/?locale=en_US&access_token=${accesstoken}`;
	try {
		const response = await axios.get(url, { validateStatus: accountValidation });
		if(response.status != 200) return console.log(`Could not fetch api for ${battleTag}, errorcode: ${response.status}`);
		const account = response.data;

		for(const hero of account.heroes) {
			if (hero.seasonal && hero.hardcore && !hero.dead) {
				try {
					// equivalent to: SELECT * FROM Characters WHERE character_id = ?;
					const character = await Characters.findOne({ where: { character_id: hero.id } });
					if(character == null) {
						// add character to DB
						try {
							const c = await Characters.create({
								battleTag: battleTag,
								character_name: hero.name,
								character_id: hero.id,
								alive: !hero.dead,
								highestSoloRiftCompleted: 0 });
							console.log(`Charater ${c.character_name} added!`);
							channel.send(`${battleTag} has created a new character: ${c.character_name}`);
						}
						catch (error) {
							console.log(`Something went wrong with adding character ${hero.name}, error: ${error.name}`);
						}
					}
					else {
						// console.log(`Character ${hero.name} already exists`);
					}
				}
				catch (error) {
					console.log(`Something went wrong with finding character ${hero.character_id}, error: ${error.name}`);
				}
			}
		}
	}
	catch (error) {
		// If its a 401 error throw it down the chain
		if(error.response.status === 401) throw error;
		else console.log(error);
	}
	// console.log(`Done with inserting characters for ${battleTag}`);
};

// Update all characters that where alive last time
const updateCharacters = async () => {
	// console.log('updating characters');
	// equivalent to: SELECT * FROM Characters WHERE alive = true;
	const characterList = await Characters.findAll({ where: { alive: true } });
	console.log(`number of characters to update ${characterList.length}`);
	await Promise.all(characterList.map(async (c) => {
		await updateCharacter(c);
	}
	)).catch((error) => {
		// If its a 401 error throw it down the chain
		if(error.response.status === 401) throw error;
		else console.log(`Somethign went wrong in updateAcounts: ${error}`);
	});

	/*
	// if we want to do it sequential instead of parralel
	for(const c of characterList) {
		await updateCharacter(c);
	}
	*/
	// console.log('Done with updating characters');
};

// Update a character while passing a character file from our database
const updateCharacter = async c => {
	// console.log(`updating ${c.character_name}`);
	const url = `https://EU.api.blizzard.com/d3/profile/${c.battleTag}/hero/${c.character_id}?locale=en_US&access_token=${accesstoken}`;
	try {
		const response = await axios.get(url, { validateStatus: charValidation });
		// Check status code if its 200 continue, if its 404 also continue
		if(response.status != 200) {
			if(response.status != 404) return console.log(`Could not fetch api for ${c.character_name}, errorcode: ${response.status}`);
		}
		const character = response.data;

		// check if character is still alive
		let aliveStatus, riftCompleted, needsUpdating;
		if (response.startsWith === 404) {
			aliveStatus = false;
			riftCompleted = c.highestSoloRiftCompleted;
		}
		else {
			aliveStatus = character.alive;
			riftCompleted = character.highestSoloRiftCompleted;
		}

		// Check if someone has died
		if(aliveStatus != true) {
			channel.send(`Uh oh ${c.character_name} has died, please give ${c.battleTag} an hug! his/her highest rift was ${riftCompleted}`);
			// equivalent to: UPDATE Accounts SET NrOfDeathCharacters = NrOfDeathCharacters + 1 WHERE name = 'tagName';
			const acount = await Accounts.findOne({ where: { battleTag: c.battleTag } });
			if (acount) acount.increment('nrOfDeathCharacters');
			// set the needsUpdating variable so we update the character
			needsUpdating = true;
		}
		// Check if someone has beaten their previous highest rift
		if (riftCompleted != c.highestSoloRiftCompleted) {
			channel.send(`${c.battleTag} has reached a new rift at ${riftCompleted} with ${c.character_name}, previous rift was ${c.highestSoloRiftCompleted}`);
			// set the needsUpdating variable so we update the character
			needsUpdating = true;
		}

		if (needsUpdating) {
			const affectedRows = await Characters.update({
				alive: aliveStatus,
				highestSoloRiftCompleted: riftCompleted },
			{ where: { character_id: c.character_id } });

			if (affectedRows == 1) {
				console.log(`character ${c.character_name} was updated.`);
			}
			else if (affectedRows == 0) {
				console.log(`character ${c.character_name} was not updated.`);
			}
			else {
				console.log(`more then 1 character was updated somehow... name was ${c.character_name} .`);
			}
		}
	}
	catch (error) {
		// If its a 401 error throw it down the chain
		if(error.response.status === 401) throw error;
		else console.log(`Error: ${error}`);
	}
	// console.log(`Done updating ${c.character_name}`);
};


client.login(botToken);

const charValidation = status => {
	// Reject only if the status code is 200 or 404
	return status === 200 || status === 404;
};

const accountValidation = status => {
	// Reject only if the status code is 200
	return status === 200;
};

/*
nodemon --inspect app.js    -- to start the bot
node dbInit.js --force		-- to update/purge the database
*/