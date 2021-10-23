const Discord = require('discord.js');
const config = require('./config.js');
const ytdl = require('ytdl-core-discord');
const { 
  joinVoiceChannel, 
  createAudioPlayer,
  createAudioResource,
} = require('@discordjs/voice');

const client = new Discord.Client({ intents: [Discord.Intents.FLAGS.GUILDS, Discord.Intents.FLAGS.GUILD_MESSAGES, Discord.Intents.FLAGS.GUILD_VOICE_STATES] });

const handleCommand = async (command, args, message) => {
  switch(command) {
    case 'test':
      message.channel.send('Hello!');
    case 'play' || 'p':
      const targetURL = args[0];
      const userVoiceChannel = client.channels.cache.get(message.member.voice.channelId);
      const voiceConnection = joinVoiceChannel({
        channelId: userVoiceChannel.id,
        guildId: message.guild.id,
        adapterCreator: message.guild.voiceAdapterCreator,
      });

      const audioPlayer = createAudioPlayer();
      try {
        voiceConnection.subscribe(audioPlayer);
        audioPlayer.play(createAudioResource(await ytdl(targetURL)), { type: 'opus' });
      } catch (err) {
        console.error(err);
      }
  }
}

client.on('ready', event => {
  console.log('Connected!');
  console.log(`Logged in as: ${client.user.tag}`);
});

client.on('messageCreate', async message => {
  if (message.content[0] === '~') {
    console.log('Getting a command!');
    const messageComponents = message.content.slice(1).split(' ');

    await handleCommand(messageComponents[0], messageComponents.slice(1), message);
  }
});

client.login(config.token);