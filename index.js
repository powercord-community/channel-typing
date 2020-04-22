/*
 * Copyright (c) 2020 Bowser65
 * Licensed under the Open Software License version 3.0
 */

const { Plugin } = require('powercord/entities');
const { Tooltip, Spinner } = require('powercord/components');
const { inject, uninject } = require('powercord/injector');
const { React, Flux, getModule, getModuleByDisplayName } = require('powercord/webpack');

module.exports = class ChannelTyping extends Plugin {
  async startPlugin () {
    this.Messages = (await getModule([ 'Messages' ])).Messages;
    const TextChannel = await getModuleByDisplayName('ChannelItem');
    const blockedStore = await getModule([ 'isBlocked', 'isFriend' ]);
    const userStore = await getModule([ 'getCurrentUser' ]);
    const memberStore = await getModule([ 'getMember' ]);
    const typingStore = await getModule([ 'getTypingUsers' ]);
    const currentUser = await getModule([ 'getCurrentUser' ]);

    const TypingIndicator = Flux.connectStores(
      [ typingStore, currentUser, userStore, memberStore, blockedStore ],
      ({ channel }) => ({
        typing: Object.keys(typingStore.getTypingUsers(channel.id))
          .filter(id => id !== currentUser.getCurrentUser().id && !blockedStore.isBlocked(id))
          .map(id => {
            const member = memberStore.getMember(channel.guild_id, id);
            if (member && member.nick) {
              return member.nick;
            }
            const user = userStore.getUser(id);
            return user ? user.username : null;
          })
          .filter(Boolean)
      })
    )(this._renderTypingElement0.bind(this));

    inject('channeltyping-channel', TextChannel.prototype, 'renderIcons', function (args, res) {
      // Other plugins cause this to rerender, leading to duplicated elements.
      if (!this.props.selected && !this.props.muted && !res.props.children.find(c => c && c.type === TypingIndicator)) {
        res.props.children.push(React.createElement(TypingIndicator, { channel: this.props.channel }));
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

  _renderTypingElement ({ typing }) {
    return typing.length < 1
      ? null
      : React.createElement(Tooltip,
        {
          position: 'top',
          text: (typing.length === 1
            ? this.Messages.ONE_USER_TYPING.format({ a: typing[0] })
            : typing.length === 2
              ? this.Messages.TWO_USERS_TYPING.format({
                a: typing[0],
                b: typing[1]
              })
              : typing.length === 3
                ? this.Messages.THREE_USERS_TYPING.format({
                  a: typing[0],
                  b: typing[1],
                  c: typing[2]
                })
                : this.Messages.SEVERAL_USERS_TYPING)
        },
        React.createElement('div',
          {
            style: {
              height: 16,
              display: 'flex',
              alignItems: 'center'
            }
          },
          React.createElement(Spinner, {
            type: 'pulsingEllipsis',
            style: {
              marginLeft: 5,
              opacity: 0.7
            }
          })
        )
      );
  }
};
