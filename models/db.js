import mongoose from 'mongoose';

const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/dropbear');

module.exports = {
  get: function() {

  },
  save: function(Model, data) {
    return new Model(data).save();
  }
};