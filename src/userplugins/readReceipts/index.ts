/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { ChannelStore, FluxDispatcher, MessageActions, UserStore } from "@webpack/common";

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

let originalSendMessage: any;

// The handler to strip the link from your own client before it renders
function stripLocalTrackingLink(event: any) {
    // Only process messages that have content
    if (!event?.message?.content || typeof event.message.content !== "string") return;

    const currentUser = UserStore.getCurrentUser();

    // If we are the author of the message being processed by the UI
    if (currentUser && event.message.author?.id === currentUser.id) {
        // Regex to find " [︀](...anything...)" and remove it
        event.message.content = event.message.content.replace(/ \[\uFE00\]\([^)]+\)/g, "");
    }
}

export default definePlugin({
    name: "ReadReceipts",
    description: "Appends a hidden read receipt link to messages.",
    authors: [{ name: "GCMarvin", id: 210406005245345792n }],
    settings,

    start() {
        // 1. Hook outgoing messages to inject the link to the server
        originalSendMessage = MessageActions.sendMessage;

        MessageActions.sendMessage = (channelId: string, message: any, ...args: any[]) => {
            const channel = ChannelStore.getChannel(channelId);

            if (channel) {
                const isDm = channel.type === 1 || channel.type === 3;
                const shouldModify = (isDm && settings.store.enableInDms) ||
                    (!isDm && settings.store.enableInServers);

                if (shouldModify && message && typeof message.content === "string") {
                    const uuid = crypto.randomUUID();
                    const cleanLink = settings.store.baseLink.replace(/\/+$/, "");
                    const invisibleChar = "\uFE00";

                    // Format: [︀](LINK/UUID) - No angle brackets!
                    const receipt = ` [${invisibleChar}](${cleanLink}/${uuid})`;
                    message.content += receipt;
                }
            }

            return originalSendMessage.call(MessageActions, channelId, message, ...args);
        };

        // 2. Hook incoming local renders to strip the link out
        FluxDispatcher.subscribe("MESSAGE_CREATE", stripLocalTrackingLink);
        FluxDispatcher.subscribe("MESSAGE_UPDATE", stripLocalTrackingLink);
    },

    stop() {
        // Restore sendMessage
        if (originalSendMessage) {
            MessageActions.sendMessage = originalSendMessage;
        }

        // Remove dispatcher hooks
        FluxDispatcher.unsubscribe("MESSAGE_CREATE", stripLocalTrackingLink);
        FluxDispatcher.unsubscribe("MESSAGE_UPDATE", stripLocalTrackingLink);
    }
});
