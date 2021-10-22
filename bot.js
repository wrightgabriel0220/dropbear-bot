const Discord = require('discord.js');
const config = require('./config.js');

const client = new Discord.Client({ intents: [Discord.Intents.FLAGS.GUILDS, Discord.Intents.FLAGS.GUILD_MESSAGES] });

client.on('ready', event => {
  console.log('Connected!');
  console.log(`Logged in as: ${client.user.tag}`);
});

client.on('messageCreate', message => {
  if (message.content[0] === '!') {
    console.log('Getting a command!');
    const messageComponents = message.content.slice(1).split(' ');

    switch(messageComponents[0]) {
      case 'test':
        message.channel.send('Hello!');
    }
  }
});

client.login(config.token);