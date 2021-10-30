module.exports = {
  list: [],
  get: function(guildId) {
    return this.list.find(channel => channel.guildId === guildId);
  },
  subscribe: function(channel, voiceConnection) {
    this.list.push({
      ...channel,
      voice: voiceConnection,
    });
    return this.list[this.list.length - 1];
  },
  unsubscribe: function(guildId) {
    this.list = this.list.filter(channel => channel.guildId !== guildId);
  }
};