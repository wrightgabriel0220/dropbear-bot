const Discord = require('discord.js');
const config = require('./config.js');

const client = new Discord.Client({ 
  intents: [
    Discord.Intents.FLAGS.GUILDS, 
    Discord.Intents.FLAGS.GUILD_MESSAGES, 
    Discord.Intents.FLAGS.GUILD_VOICE_STATES
  ] 
});

const commands = {
  ...require('./services/dropbear.js'),
  ...require('./services/radio.js'),
};

client.on('ready', event => {
  console.log('Connected!');
  console.log(`Logged in as: ${client.user.tag}`);
});

client.on('messageCreate', async message => {
  if (message.content[0] === '~') {
    console.log(`${message.member.user.username}: ${message.content}`);
    const messageComponents = message.content.slice(1).split(' ');
    
    if (commands[messageComponents[0]]) {
      await commands[messageComponents[0]](message, messageComponents.slice(1), client);
    } else {
      message.channel.send(`I'm not sure what ${messageComponents.join(' ')} means. Try a valid command.`);
    }
  }
});

client.login(config.token);