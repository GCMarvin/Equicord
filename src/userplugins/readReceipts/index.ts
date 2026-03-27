/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { addMessagePreSendListener, MessageSendListener, removeMessagePreSendListener } from "@api/MessageEvents";
import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { FluxDispatcher, UserStore } from "@webpack/common";

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

function stripOwnTrackingLink(event: any) {
    const { message } = event;
    if (!message?.content || typeof message.content !== "string") return;

    const currentUser = UserStore.getCurrentUser();
    if (!currentUser || message.author?.id !== currentUser.id) return;

    const baseLink = settings.store.baseLink.replace(/\/+$/, "");
    if (!baseLink) return;

    const escaped = baseLink.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(` \\[\uFE00\\]\\(${escaped}/[^)]+\\)`);
    message.content = message.content.replace(pattern, "");

    if (message.embeds?.length) {
        message.embeds = message.embeds.filter(
            (e: any) => !e?.url?.startsWith(baseLink)
        );
    }
}

let preSendListener: MessageSendListener;
let origDispatch: typeof FluxDispatcher.dispatch;

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

        origDispatch = FluxDispatcher.dispatch;
        FluxDispatcher.dispatch = function (event: any) {
            if ((event.type === "MESSAGE_CREATE" || event.type === "MESSAGE_UPDATE") && event.message) {
                stripOwnTrackingLink(event);
            }
            return origDispatch.call(this, event);
        };
    },

    stop() {
        removeMessagePreSendListener(preSendListener);
        FluxDispatcher.dispatch = origDispatch;
    }
});
