const { 
  joinVoiceChannel, 
  createAudioPlayer,
  createAudioResource,
  getVoiceConnection,
} = require('@discordjs/voice');
const audioPlayer = createAudioPlayer();
const ytdl = require('ytdl-core-discord');

module.exports = {
  play: async (message, args, client) => {
    const targetURL = args[0];
    const userVoiceChannel = client.channels.cache.get(message.member.voice.channelId);
    if (userVoiceChannel) {
      const voiceConnection = joinVoiceChannel({
        channelId: userVoiceChannel.id,
        guildId: message.guild.id,
        adapterCreator: message.guild.voiceAdapterCreator,
      });

      try {
        voiceConnection.subscribe(audioPlayer);
        audioPlayer.play(createAudioResource(await ytdl(targetURL)), { type: 'opus' });
      } catch (err) {
        console.error(err);
        message.channel.send('There was an error ')
      }
    } else {
      message.channel.send('You must be in a voice channel to use this command!');
    }
  },
  stop: message => {
    message.channel.send('Stopping playback');
    audioPlayer.stop();
  },
  die: message => {
    message.channel.send('Goodbye!');
    audioPlayer.stop();
    getVoiceConnection(message.guildId).disconnect();
  },
  p: this.play,
  pause: this.stop,
};