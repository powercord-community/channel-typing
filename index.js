/*
 * Copyright (c) 2020 Bowser65
 * Licensed under the Open Software License version 3.0
 */

const { Plugin } = require('powercord/entities');
const { Tooltip, Spinner } = require('powercord/components');
const { inject, uninject } = require('powercord/injector');
const { React, Flux, getModule, getModuleByDisplayName } = require('powercord/webpack');

const fluxConnector = Flux.connectStoresAsync(
  [
    getModule([ 'getTypingUsers' ]),
    getModule([ 'getCurrentUser' ]),
    getModule([ 'getMember' ]),
    getModule([ 'isBlocked', 'isFriend' ])
  ],
  ([ typingStore, userStore, memberStore, blockedStore ], { channel }) => ({
    typing: Object.keys(typingStore.getTypingUsers(channel.id))
      .filter(id => id !== userStore.getCurrentUser().id && !blockedStore.isBlocked(id))
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
);

module.exports = class ChannelTyping extends Plugin {
  async startPlugin () {
    this.Messages = (await getModule([ 'Messages' ])).Messages;
    const TextChannel = await getModuleByDisplayName('ChannelItem');
    const PrivateChannel = await getModuleByDisplayName('PrivateChannel');

    const TypingIndicator = fluxConnector((props) => this._renderTypingElement(props));
    const TypingOrChildren = fluxConnector((props) => this._renderGroupTyping(props));

    inject('channeltyping-channel', TextChannel.prototype, 'renderIcons', function (_, res) {
      // Other plugins cause this to rerender, leading to duplicated elements.
      if (!this.props.selected && !this.props.muted && !res.props.children.find(c => c && c.type === TypingIndicator)) {
        res.props.children.push(React.createElement(TypingIndicator, { channel: this.props.channel }));
      }
      return res;
    });

    inject('channeltyping-dm-groups', PrivateChannel.prototype, 'renderSubtitle', function (_, res) {
      if (this.props.channel.isGroupDM()) {
        const { children } = res.props;
        res.props.children = React.createElement(TypingOrChildren, { channel: this.props.channel }, children);
      }
      return res;
    });
  }

  pluginWillUnload () {
    uninject('channeltyping-channel');
    uninject('channeltyping-dm-groups');
  }

  _renderGroupTyping ({ typing, children }) {
    return typing.length < 1
      ? children
      : this._formatTyping(typing);
  }

  _renderTypingElement ({ typing }) {
    return typing.length < 1
      ? null
      : React.createElement(Tooltip,
        {
          position: 'top',
          text: this._formatTyping(typing)
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

  _formatTyping (typing) {
    return typing.length === 1
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
          : this.Messages.SEVERAL_USERS_TYPING;
  }
};
