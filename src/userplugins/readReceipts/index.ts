/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { addMessagePreSendListener, MessageSendListener, removeMessagePreSendListener } from "@api/MessageEvents";
import { definePluginSettings } from "@api/Settings";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";
import { Constants, FluxDispatcher, RestAPI, UserStore } from "@webpack/common";

const SUPPRESS_EMBEDS = 1 << 2;
const trackingLinkPattern = / \[\uFE00\]\([^)]+\)/;
const logger = new Logger("ReadReceipts");

const settings = definePluginSettings({
    baseLink: {
        type: OptionType.STRING,
        default: "https://your-domain.com/receipt",
        description: "The base URL for the read receipt link.",
        name: "Base Link"
    },
    enableInDms: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Append the hidden read receipt in Direct Messages.",
        name: "Enable in DMs"
    },
    enableInServers: {
        type: OptionType.BOOLEAN,
        default: false,
        description: "Append the hidden read receipt in Servers.",
        name: "Enable in Servers"
    }
});

function suppressEmbedsForTrackedMessage(event: any) {
    if (!event?.message?.content || typeof event.message.content !== "string") return;

    const currentUser = UserStore.getCurrentUser();
    if (!currentUser || event.message.author?.id !== currentUser.id) return;

    if (trackingLinkPattern.test(event.message.content)) {
        RestAPI.patch({
            url: Constants.Endpoints.MESSAGE(event.message.channel_id, event.message.id),
            body: { flags: (event.message.flags ?? 0) | SUPPRESS_EMBEDS }
        }).catch(e => logger.error("Failed to suppress embeds", e));
    }
}

let preSendListener: MessageSendListener;

export default definePlugin({
    name: "ReadReceipts",
    description: "Appends a hidden read receipt link to messages.",
    authors: [{ name: "GCMarvin", id: 210406005245345792n }],
    settings,

    start() {
        preSendListener = addMessagePreSendListener((_channelId, messageObj, options) => {
            const { channel } = options;
            if (!channel) return;

            const isDm = channel.type === 1 || channel.type === 3;
            const shouldModify = (isDm && settings.store.enableInDms) ||
                (!isDm && settings.store.enableInServers);

            if (shouldModify && messageObj.content) {
                const uuid = crypto.randomUUID();
                const cleanLink = settings.store.baseLink.replace(/\/+$/, "");
                messageObj.content += ` [\uFE00](${cleanLink}/${uuid})`;
            }
        });

        FluxDispatcher.subscribe("MESSAGE_CREATE", suppressEmbedsForTrackedMessage);
    },

    stop() {
        removeMessagePreSendListener(preSendListener);
        FluxDispatcher.unsubscribe("MESSAGE_CREATE", suppressEmbedsForTrackedMessage);
    }
});
