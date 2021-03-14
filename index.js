/*
 * Copyright (c) 2020 Bowser65
 * Licensed under the Open Software License version 3.0
 */

const { Plugin } = require('powercord/entities');
const { Tooltip, Spinner } = require('powercord/components');
const { inject, uninject } = require('powercord/injector');
const { React, Flux, getModule, getModuleByDisplayName, i18n: { Messages } } = require('powercord/webpack');
const { findInReactTree } = require('powercord/util');

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
    const TextChannel = await getModule(m => m.default?.displayName === 'ChannelItem');
    const PrivateChannel = await getModuleByDisplayName('PrivateChannel');

    const TypingIndicator = fluxConnector((props) => this._renderTypingElement(props));
    const TypingOrChildren = fluxConnector((props) => this._renderGroupTyping(props));

    inject('channeltyping-channel', TextChannel, 'default', (args, res) => {
      // Other plugins cause this to rerender, leading to duplicated elements.
      if (args[0].selected || args[0].muted) {
        return res;
      }

      const icons = findInReactTree(res, n => n.className?.startsWith('children-'));
      if (!icons.children.find(c => c && c.type === TypingIndicator)) {
        icons.children.push(React.createElement(TypingIndicator, { channel: args[0].channel }));
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

    TextChannel.default.displayName = 'ChannelItem';
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
          text: this._formatTyping(typing),
          className: 'channel-typing'
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
            animated: document.hasFocus(),
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
      ? Messages.ONE_USER_TYPING.format({ a: typing[0] })
      : typing.length === 2
        ? Messages.TWO_USERS_TYPING.format({
          a: typing[0],
          b: typing[1]
        })
        : typing.length === 3
          ? Messages.THREE_USERS_TYPING.format({
            a: typing[0],
            b: typing[1],
            c: typing[2]
          })
          : Messages.SEVERAL_USERS_TYPING;
  }
};
