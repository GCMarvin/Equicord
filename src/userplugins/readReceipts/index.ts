/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { addMessagePreSendListener, MessageSendListener, removeMessagePreSendListener } from "@api/MessageEvents";
import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";

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

let preSendListener: MessageSendListener;

export default definePlugin({
    name: "ReadReceipts",
    description: "Appends a hidden read receipt link to messages.",
    authors: [{ name: "GCMarvin", id: 210406005245345792n }],
    settings,

    patches: [{
        find: "renderEmbeds(",
        replacement: {
            match: /(?<=renderEmbeds\(\i\){.{0,500}embeds\.map\(\((\i),\i\)?=>{)/,
            replace: "$&if($self.isTrackingEmbed($1))return null;"
        }
    }],

    isTrackingEmbed(embed: any) {
        const baseLink = settings.store.baseLink.replace(/\/+$/, "");
        return embed?.url?.startsWith(baseLink);
    },

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
    },

    stop() {
        removeMessagePreSendListener(preSendListener);
    }
});
