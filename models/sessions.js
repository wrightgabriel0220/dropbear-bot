module.exports = {
  list: [],
  get: function(guildId) {
    return this.list.find(channel => channel.guildId === guildId);
  },
  subscribe: function(channel, voiceConnection) {
    let session = {
      ...channel,
      voice: voiceConnection,
    };

    session.voice.on('stateChange', (oldState, newState) => {
      if (newState.status === 'disconnected') {
        this.unsubscribe(channel.guildId);
      }
    });

    this.list.push(session);

    return this.list[this.list.length - 1];
  },
  unsubscribe: function(guildId) {
    this.list = this.list.filter(channel => channel.guildId !== guildId);
  },
};