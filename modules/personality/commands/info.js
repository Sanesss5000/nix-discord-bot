const Rx = require('rx');
const git = require('git-rev');

const pkg = require('../../../package.json');

const GitHashShort$ = Rx.Observable.fromCallback(git.short);

module.exports = {
  name: "info",
  description: "Gets information about me",

  run (context, response) {
    return GitHashShort$()
      .map((gitHash) => {
        response.type = 'message';
        response.content = getResponseBody(gitHash);
        return response.send();
      });
  },
};

function getResponseBody(gitHash) {
  return [
    'Hello!',
    'My name is Nix, and I was created to help automate some things on this Discord server.',
    'My creator is SpyMaster356, and you can find him by the same name on Steam, Twitter, Github, Overwatch, and Reddit.',
    'I\'m currently using build ' + gitHash + ' of my code.',
    'You can view my source code on GitHub at ' + pkg.repository,
    'My avatar was drawn by XHI on DeviantArt. You can find the original artwork here: https://xhi.deviantart.com/art/Tifa-Lockhart-2011-211185076',
  ].join('\n\n');
}
