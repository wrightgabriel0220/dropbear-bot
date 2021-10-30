const ytdl = require('ytdl-core-discord');
const axios = require('axios');
const connections = require('../models/connections.js');
const { 
  joinVoiceChannel, 
  createAudioPlayer,
  createAudioResource,
} = require('@discordjs/voice');
const config = require('../config');

class Radio {
  constructor() {
    this.isActive = false;
    this.queue = [];
    this.audioPlayer = createAudioPlayer();

    this.audioPlayer.on('error', event => {
      console.error(`There was an error with the stream/audio resource: ${event}`);
      this.audioPlayer.unpause();
    });
  
    this.audioPlayer.on('idle', (event => {
      if (this.isActive) {
        this.queue = this.queue.slice(1);
        if (this.queue.length > 0) {
          this.audioPlayer.play(this.queue[0].audio, { type: 'opus' });
        }
      }
    }).bind(this));
  };

  getQueueAsString() {
    if (this.queue.length === 0) { return 'There\'s currently nothing in the queue. Try !play <target audio> to add something!'; }

    let queueMessage = '\nCurrent queue: ';
    this.queue.forEach((audioResource, index) => {
      queueMessage = queueMessage.concat(`\n${index + 1}: ${audioResource.meta.videoDetails.title}`);
    });
    return queueMessage;
  }

  async play(message, targetURL) {
    try {
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
      if (this.audioPlayer.state.status !== 'playing') {
        if (this.queue.length > 0) {
          this.audioPlayer.play(this.queue[0].audio, { type: 'opus' });
        }
      }
      message.channel.send(this.getQueueAsString());
      this.isActive = true;
    } catch (err) {
      console.error(err.message);
      message.channel.send(`There was an error: ${err.message}`);
    }
  }
};

const getConnectionToUserVoiceChannel = (message, client) => {
  try {
    const userVoiceChannel = client.channels.cache.get(message.member.voice.channelId);
    if (userVoiceChannel) {
      return [
        userVoiceChannel,
        joinVoiceChannel({
          channelId: userVoiceChannel.id,
          guildId: message.guild.id,
          adapterCreator: message.guild.voiceAdapterCreator,
        }),
      ];
    }
  } catch (err) {
    return err;
  }
};

module.exports = {
  play: async (message, args, client) => {
    let targetURL;
    if (args[0]) {
      // If we have an actual URL, just use the URL
      if (args[0].startsWith('https://www.youtube.com/watch?v=')) {
        targetURL = args[0];
        let currConnection = connections.get(message.guildId);
        if (currConnection === undefined) {
          currConnection = connections.subscribe(...getConnectionToUserVoiceChannel(message, client));
          currConnection.radio = new Radio();
          currConnection.voice.subscribe(currConnection.radio.audioPlayer);
        } else {
          message.channel.send('You must be in a voice channel to use this command!');
        }
        if (currConnection.voice) {
          currConnection.radio.play(message, targetURL);
        }
      // If not, then we have keywords, so try a keyword search
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
                targetURL = `https://www.youtube.com/watch?v=${results.data.items[msg.content - 1].id.videoId}`;
                let currConnection = connections.get(message.guildId);
                if (connections.get(message.guildId) === undefined) {
                  currConnection = connections.subscribe(...getConnectionToUserVoiceChannel(message, client));
                  currConnection.radio = new Radio();
                  currConnection.voice.subscribe(currConnection.radio.audioPlayer);
                }
                if (currConnection.voice) {
                  currConnection.radio.play(message, targetURL);
                } else {
                  message.channel.send('You must be in a voice channel to use this command!');
                }
              } else {
                throw Error('Invalid input for numbers 1-5');
              }
            })
            .catch(err => {
              message.channel.send('Aborting search operation. Please enter a number between 1 and 5 inclusive next time.');
              message.channel.send('Error report: ', err.message);
            });
          });
      }
    } else {
      try {
        let currConnection = connections.get(message.guildId);
        currConnection.radio.isActive = true;
        currConnection.radio.audioPlayer.unpause();
      } catch (err) {
        message.channel.send('The bot must have an active queue to begin playback!');
        console.error(err);
      }
    }
  },
  stop: message => {
    try {
      let radio = connections.get(message.guildId).radio;
      message.channel.send('Stopping playback');
      radio.audioPlayer.pause();
      radio.isActive = false;
    } catch (err) {
      message.channel.send(`There was an error stopping playback: ${err.message}`);
    }
  },
  die: message => {
    message.channel.send('Goodbye!');
    try {
      let currConnection = connections.get(message.guildId);
      currConnection.radio.audioPlayer.stop();
      currConnection.radio.queue = [];
      currConnection.voice.disconnect();
      connections.unsubscribe(message.guildId);
    } catch (err) {
      message.channel.send('There was an error disconnecting the bot. Perhaps the connection could not be identified?');
      console.error(`bot DC error: ${err.message}`);
      message.channel.send('Error: ', err);
    }
  },
  queue: message => {
    let radio = connections.get(message.guildId).radio;
    message.channel.send(radio.getQueueAsString());
  },
  current: message => {
    let radio = connections.get(message.guildId).radio;
    message.channel.send(`${radio.queue[0].meta.title} --- Duration: ${radio.queue[0].getTimeRemainingInMillis()}`);
  },
  skip: message => {
    message.channel.send('Skipping...');
    try {
      let audioPlayer = connections.get(message.guildId).radio.audioPlayer;
      audioPlayer.unpause();
      audioPlayer.stop();
    } catch (err) {
      message.channel.send('There was an error skipping: ', err.message);
    }
  },
  clear: (message, args) => {
    try {
      let radio = connections.get(message.guildId).radio;
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
    } catch (err) {
      message.channel.send('Something went wrong with clearing the queue. Use !queue to confirm the current status of the queue');
      message.channel.send('Error: ', err.message);
    }
  },
};