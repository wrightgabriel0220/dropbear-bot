const { 
  joinVoiceChannel, 
  createAudioPlayer,
  createAudioResource,
  getVoiceConnection,
} = require('@discordjs/voice');
const ytdl = require('ytdl-core-discord');

const audioPlayer = createAudioPlayer();

const radio = {
  isActive: false,
  queue: [],
  getQueueAsString: function() {
    if (radio.queue.length === 0) { return 'There\'s currently nothing in the queue. Try ~play <target audio> to add something!'; }

    let queueMessage = '\nCurrent queue: ';
    radio.queue.forEach((audioResource, index) => {
      queueMessage = queueMessage.concat(`\n${index + 1}: ${audioResource.meta.videoDetails.title}`);
    });
    return queueMessage;
  }
};

const tryPlayFromQueue = () => {
  if (radio.queue.length > 0) {
    audioPlayer.play(radio.queue[0].audio, { type: 'opus' });
  }
}

audioPlayer.on('idle', event => {
  if (radio.isActive) {
    radio.queue = radio.queue.slice(1);
    if (radio.queue.length > 0) {
      tryPlayFromQueue();
    }
  }
})

module.exports = {
  play: async (message, args, client) => {
    let targetURL;
    if (args[0]) {
      if (args[0].startsWith('https://www.youtube.com/watch?v=')) {
        targetURL = args[0];
      } else {
        console.log('TODO: Attempt to search youtube videos using the youtube API');
        // TODO: Attempt to search youtube videos using the youtube API
        targetURL = 'https://www.youtube.com/watch?v=MEg-oqI9qmw'; // Astronaut in the Ocean;
      }
      const userVoiceChannel = client.channels.cache.get(message.member.voice.channelId);
      if (userVoiceChannel) {
        const voiceConnection = joinVoiceChannel({
          channelId: userVoiceChannel.id,
          guildId: message.guild.id,
          adapterCreator: message.guild.voiceAdapterCreator,
        });

        try {
          voiceConnection.subscribe(audioPlayer);
          radio.queue.push({
            audio: createAudioResource(await ytdl(targetURL), {}),
            meta: await ytdl.getBasicInfo(targetURL),
            getTimeRemainingInMillis: function() {
              return this.meta.videoDetails.lengthSeconds - this.audio.playbackDuration / 1000
            },
          });
          if (audioPlayer.state.status !== 'playing') {
            tryPlayFromQueue();
          }
          message.channel.send(radio.getQueueAsString());
          radio.isActive = true;
          console.log('time left: ', radio.queue[0].getTimeRemainingInMillis());
        } catch (err) {
          console.error(err.message);
          message.channel.send(`There was an error: ${err.message}`);
        }
      } else {
        message.channel.send('You must be in a voice channel to use this command!');
      }
    } else {
      radio.isActive = true;
      audioPlayer.unpause();
    }
  },
  stop: message => {
    message.channel.send('Stopping playback');
    audioPlayer.pause();
    radio.isActive = false;
  },
  die: message => {
    message.channel.send('Goodbye!');
    audioPlayer.stop();
    radio.queue = [];
    getVoiceConnection(message.guildId).disconnect();
  },
  queue: message => {
    message.channel.send(radio.getQueueAsString());
  },
  skip: message => {
    message.channel.send('Skipping...');
    audioPlayer.stop();
    console.log('audioPlayer status during skip: ', audioPlayer.state.status);
  },
  p: this.play,
  pause: this.stop,
};