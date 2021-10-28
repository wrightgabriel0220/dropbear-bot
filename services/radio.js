const ytdl = require('ytdl-core-discord');
const axios = require('axios');
const { 
  joinVoiceChannel, 
  createAudioPlayer,
  createAudioResource,
  getVoiceConnection,
} = require('@discordjs/voice');
const config = require('../config');

const audioPlayer = createAudioPlayer();

audioPlayer.on('error', event => {
  console.error(`There was an error with the stream/audio resource: ${event}`);
  audioPlayer.unpause();
})

const radio = {
  isActive: false,
  queue: [],
  getQueueAsString: function() {
    if (radio.queue.length === 0) { return 'There\'s currently nothing in the queue. Try !play <target audio> to add something!'; }

    let queueMessage = '\nCurrent queue: ';
    radio.queue.forEach((audioResource, index) => {
      queueMessage = queueMessage.concat(`\n${index + 1}: ${audioResource.meta.videoDetails.title}`);
    });
    return queueMessage;
  },
  play: async function(voiceConnection, message, targetURL) {
    try {
      voiceConnection.subscribe(audioPlayer);
      this.queue.push({
        audio: createAudioResource(await ytdl(targetURL, { highWaterMark: 1<<25 }), {}),
        meta: await ytdl.getBasicInfo(targetURL),
        getTimeRemainingInMillis: function() {
          let secondsLeft = Math.round(this.meta.videoDetails.lengthSeconds - this.audio.playbackDuration / 1000);
          let minutesLeft = Math.round(secondsLeft / 60);
          let totalMinutes = Math.round(this.meta.videoDetails.lengthSeconds / 60);
          return `${minutesLeft}:${Math.round(secondsLeft % 60)}/${totalMinutes}:${Math.round(this.meta.videoDetails.lengthSeconds % 60)}`;
        },
      });
      if (audioPlayer.state.status !== 'playing') {
        tryPlayFromQueue();
      }
      message.channel.send(this.getQueueAsString());
      this.isActive = true;
    } catch (err) {
      console.error(err.message);
      message.channel.send(`There was an error: ${err.message}`);
    }
  }
};

const tryPlayFromQueue = () => {
  if (radio.queue.length > 0) {
    audioPlayer.play(radio.queue[0].audio, { type: 'opus' });
  }
};

const connectToUserVoiceChannel = (message, client) => {
  try {
    const userVoiceChannel = client.channels.cache.get(message.member.voice.channelId);
    if (userVoiceChannel) {
      return joinVoiceChannel({
        channelId: userVoiceChannel.id,
        guildId: message.guild.id,
        adapterCreator: message.guild.voiceAdapterCreator,
      });
    }
  } catch (err) {
    return err;
  }
};

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
        const voiceConnection = connectToUserVoiceChannel(message, client);
        if (voiceConnection) {
          radio.play(voiceConnection, message, targetURL);
        }
      } else {
        const options = {
          params: {
            maxResults: 5,
            q: args.join(' '),
            part: 'snippet',
            type: 'video',
          },
        };

        axios.get(`https://www.googleapis.com/youtube/v3/search?key=${config.youtube.key}`, options)
          .then(async results => {
            let resultString = 'Results: ';
            results.data.items.forEach((video, index) => {
              resultString += `\n${index + 1}: ${video.snippet.title}`;
            });
            message.channel.send(resultString + '\n Enter a number to play the corresponding youtube audio.');
            const filter = m => m.author.id == message.author.id;
            await message.channel.awaitMessages({
              filter: filter,
              max: 1,
              time: 30000,
              errors: ['time'],
            })
            .then(msg => {
              msg = msg.first();
              
              if (Number(msg.content) >= 1 && Number(msg.content) <= 5) {
                const voiceConnection = connectToUserVoiceChannel(message, client);
                if (voiceConnection) {
                  targetURL = `https://www.youtube.com/watch?v=${results.data.items[Number(msg.content) - 1].id.videoId}`
                  return radio.play(voiceConnection, message, targetURL);
                } else {
                  message.channel.send('You must be in a voice channel to use this command!');
                }
              } else {
                throw Error('Invalid input for numbers 1-5');
              }
            })
            .catch(err => {
              message.channel.send('Aborting search operation. Please enter a number between 1 and 5 inclusive next time.');
              message.channel.send('Error report: ', err);
            });
          });

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
  current: message => {
    message.channel.send(`${radio.queue[0].meta.title} --- Duration: ${radio.queue[0].getTimeRemainingInMillis()}`);
  },
  skip: message => {
    message.channel.send('Skipping...');
    audioPlayer.unpause();
    audioPlayer.stop();
    console.log('audioPlayer status during skip: ', audioPlayer.state.status);
  },
  clear: (message, args) => {
    if (args[0]) {
      if (radio.queue[Number(args[0]) - 1]) {
        radio.queue = radio.queue.slice(0, Number(args[0]) - 1).concat(radio.queue.slice(Number(args[0])));
        message.channel.send(radio.getQueueAsString());
      } else {
        message.channel.send(`There is no audio at position ${Number(args[0]) - 1} in the queue.`);
        return;
      }
    } else {
      message.channel.send('Clearing entire queue...');
      radio.queue = [];
      audioPlayer.stop();
    }
  },
};