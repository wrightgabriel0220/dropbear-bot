const config = require('./../config.js');
const path = require('path'); 
const fs = require('fs/promises');
const parseJSON = require('parse-json');

const BLANK = () => {};

const CONFIGPATH = path.resolve(__dirname, './../config.js');

const basicFailCb = message => {
  message.channel.send('You lack the permissions to execute this command!');
};

const tryAuth = (message, successCb = BLANK, failCb = BLANK) => {
  if (config.admins.includes(message.author.id)) {
    successCb(message);
    return true;
  } else {
    failCb(message);
    return false;
  }
};

module.exports = {
  'admin?': message => tryAuth(message,
    message => {
      message.channel.send('You\'re already an admin, silly!');
      console.log('current directory: ', __dirname);
    },
    message => {
      message.channel.send('Requesting admin privileges...');
      message.channel.send('Awaiting a response from an admin: Y or N');
      const filter = m => tryAuth(m) && (m.content.toUpperCase() === 'Y' || m.content.toUpperCase() === 'N');
      message.channel.awaitMessages({
        filter: filter,
        max: 1,
        time: 50000,
        errors: ['time'],
      })
      .then(msg => {
        msg = msg.first();
        
        if (msg.content.toUpperCase() === 'Y') {
          fs.readFile(CONFIGPATH).then(results => {
            const adminsIndex = results.indexOf('admins: [');
            newConfig = results.slice(0, adminsIndex + 9) + `\n\t\t'${message.author.id}',` + results.slice(adminsIndex + 9 + 1);
            fs.writeFile(CONFIGPATH, Buffer.from(newConfig, 'utf-8')).then(writeResults => {
              console.log('writeResults: ', writeResults);
              message.channel.send(`Wooooo, making ${message.author.username} an admin!`);
            })
          }).catch(err => {
            message.channel.send('There was an error updating your admin status. Please try again later.');
            console.error('Error: ', err);
          });
          
        }
      });
    }),
};
