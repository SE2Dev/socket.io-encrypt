const Cryptr = require('cryptr');
const { emit, on, send } = require('./symbol');
const reservedEvents = require('./reserved-events');

module.exports = (secret) => (socket, next) => {
  const cryptr = new Cryptr(secret);

  const encrypt = args => {
    const encrypted = [];
    let ack
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (i === args.length - 1 && typeof arg === 'function') {
        ack = arg;
      } else {
        encrypted.push(cryptr.encrypt(JSON.stringify(arg)));
      }

    }
    if (!encrypted.length) return args;
    args = [{ encrypted }];
    if (ack) args.push(ack);
    return args;
  };

  const decrypt = encrypted => {
    try {
      return encrypted.map(a => JSON.parse(cryptr.decrypt(a)))
    } catch (error) {
      throw new Error(`Couldn't decrypt. ${error.message}`);
    }
  };

  socket[emit] = socket.emit;
  socket[on] = socket.on;

  socket.emit = (event, ...args) => {
    if (reservedEvents.includes(event)) return socket[emit](event, ...args);

    return socket[emit](event, ...encrypt(args));
  };

  socket.on = (event, handler) => {
    if (reservedEvents.includes(event)) return socket[on](event, handler);

    return socket[on](event, function(...args) {
      if (args[0] && args[0].encrypted) {
        args = decrypt(args[0].encrypted);
      }
      return handler.call(this, ...args);
    });
  };

  if (next) next();
  return socket;
};
