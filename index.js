const { Plugin } = require('powercord/entities');
const { Spinner } = require('powercord/components');
const { inject, uninject } = require('powercord/injector');
const { React, Flux, getModule, getModuleByDisplayName } = require('powercord/webpack');

module.exports = class ChannelTyping extends Plugin {
  async startPlugin () {
    const TextChannel = await getModuleByDisplayName('ChannelItem');
    const typingStore = await getModule([ 'getTypingUsers' ]);
    const currentUser = await getModule([ 'getCurrentUser' ]);

    const TypingIndicator = Flux.connectStores(
      [ typingStore ],
      ({ id }) => ({ typingCount: Object.keys(typingStore.getTypingUsers(id)).filter(id => id !== currentUser.getCurrentUser().id).length })
    )(this._renderTypingElement0.bind(this));

    inject('channeltyping-channel', TextChannel.prototype, 'renderIcons', function (args, res) {
      // Other plugins cause this to rerender, leading to duplicated elements.
      if (!this.props.selected && !this.props.muted && !res.props.children.find(c => c && c.type === TypingIndicator)) {
        res.props.children.push(React.createElement(TypingIndicator, { id: this.props.channel.id }));
      }
      return res;
    });
  }

  pluginWillUnload () {
    uninject('channeltyping-channel');
  }

  // thats made so plugins can inject custom logic in _renderTypingElement. used by betterfriends.
  _renderTypingElement0 (props) {
    return this._renderTypingElement(props);
  }

  _renderTypingElement ({ typingCount }) {
    return typingCount < 1
      ? null
      : React.createElement(Spinner, {
        type: 'pulsingEllipsis',
        style: {
          marginLeft: 5,
          opacity: 0.7
        }
      });
  }
};
