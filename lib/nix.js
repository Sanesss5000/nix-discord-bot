'use strict';

const fs = require('fs');
const Path = require('path');
const Rx = require('rx');

const DataManager = require('./data-manager');
const Command = require('./command');

class Nix {
  /**
   * Create a new instance of Nix
   *
   * @param discordClient {Client} the Discord client to use
   * @param config {Object} The settings for Nix to use
   */
  constructor(discordClient, config) {
    this._discord = discordClient;

    this._loginToken = config.loginToken;
    this._ownerUserId = config.ownerUserId;
    this._owner = null;
    this._games = config.games;

    this._message$ = this._createMessageStream();
    this._disconnect$ = this._createDisconnectStream();
    this._command$ = this._createCommandStream(this._message$);
    this._newGame$ = this._createNewGameStream();

    this.listening = false;
    this.commands = {};

    this.dataManager = new DataManager(config);

  }

  addCommand(command) {
    console.log("adding command", command.name);
    this.commands[command.name] = command;
  }

  listen() {
    this.listening = true;

    return Rx.Observable.fromPromise(this.discord.login(this._loginToken))
      .flatMap(() => this._findOwner())
      .flatMap(() => {
        return Rx.Observable.merge([
          this._message$,
          this._disconnect$,
          this._command$,
          this._newGame$,
          this.messageOwner("I'm now online."),
        ]);
      })
      .takeWhile(() => this.listening)
      .doOnError(() => this.shutdown())
      .ignoreElements();
  }

  shutdown() {
    console.log('No longer listening');
    this.listening = false;
  }

  messageOwner(message) {
    if(this.owner !== null) {
      return Rx.Observable.fromPromise(this.owner.send(message));
    } else {
      return Rx.Observable.throw('Owner was not found.');
    }
  }

  get discord() {
    return this._discord;
  }

  get owner() {
    return this._owner;
  }

  get games() {
    return this._games;
  }

  getRandomGame() {
    return this.games[Math.floor(Math.random() * this.games.length)];
  }

  _findCommandForMsg(message) {
    let commandParts = message.content.split(' ');
    let commandName = commandParts[0].slice(1);

    return this.commands[commandName];
  }

  _createMessageStream() {
    return Rx.Observable.fromEvent(this._discord, 'message');
  }

  _createDisconnectStream() {
    return Rx.Observable.fromEvent(this._discord, 'disconnect')
      .do((message) => console.error('Disconnected from Discord with code "' + message.code + '" for reason: ' + message))
      .flatMap((message) => this.messageOwner('I was disconnected. :( \nError code was ' + message.code));
  }

  _createCommandStream(message$) {
    return message$
      .filter((message) => Command.msgIsCommand(message, this.commands))
      .map((message) => {
        return {
          command: this._findCommandForMsg(message),
          message: message,
        };
      })
      .flatMap(({command, message}) => command.runCommand(message, this))
      .catch((error) => {
        console.error(error);
        this.messageOwner('Unhandled error: ' + error);

        // Restart the stream so that Nix continues to handle commands
        return this._createCommandStream(message$);
      });
  }

  _findOwner() {
    return Rx.Observable.fromPromise(this._discord.fetchUser(this._ownerUserId))
      .do((user) => this._owner = user);
  }

  _createNewGameStream() {
    return Rx.Observable.merge([
      this._setNewGame(),
      Rx.Observable.interval(300000)
        .flatMap(() => this._setNewGame()),
    ]);
  }

  _setNewGame() {
    return Rx.Observable.just(this.getRandomGame())
      .flatMap((newGame) => this.discord.user.setGame(newGame));
  }
}

module.exports = Nix;
