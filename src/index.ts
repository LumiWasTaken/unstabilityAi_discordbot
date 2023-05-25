import {
    Client,
    IntentsBitField,
    EmbedBuilder,
    CommandInteraction,
    AttachmentBuilder
} from 'discord.js';
import axios from 'axios';
import WebSocket from 'ws';
import {
    config
} from 'dotenv';
import {
    GenRequest,
    GenProgressWS
} from './types';
import {
    queueCommand
} from './commands'

let pingInterval: NodeJS.Timeout | null = null;

config();

async function registerSlashCommand() {
    try {
        if (!process.env.GUILD_ID) {
            console.error("NO GUILD_ID SET");
            process.exit(1);
        }


        const guild = client.guilds.cache.get(process.env.GUILD_ID);

        if (!guild) {
            console.error("NO GUILD FOUND");
            process.exit(1);
        }

        const existingCommands = await guild.commands.fetch();

        const existingCommand = existingCommands.find(command => command.name === queueCommand.name);
        if (!existingCommand) {
            await guild.commands.set([queueCommand])
            console.log('Slash commands registered successfully!');
        } else {
            await existingCommand.edit(queueCommand);
            console.log('Slash command edited successfully!');
        }
    } catch (error) {
        console.error('Failed to register slash commands:', error);
    }
}


const client = new Client({
    intents: [1, IntentsBitField.Flags.Guilds, IntentsBitField.Flags.GuildMessages],
});

interface Request {
    interaction: CommandInteraction;
    GenRequest: GenRequest;
}

let localQueue: Map < string, Request > = new Map();
let serverQueue: Map < string, Request > = new Map();

const maxProcessingCount = 3;

fetchWebSocketURL().then(wsUrl => {
    if (wsUrl) {
        startWebSocket(wsUrl);
    }
});

async function fetchWebSocketURL() {
    try {
        const response = await axios.get("https://www.unstability.ai/api/getWebSocketURL", {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/113.0",
                'cookie': `__Secure-next-auth.session-token=${process.env.SECRET_TOKEN}`
            },
        });
        const wsUrl = response.data.url;
        return wsUrl;
    } catch (err) {
        console.error('Failed to fetch WebSocket URL:', err);
        return null;
    }
}

function startWebSocket(wsUrl: string) {
    const ws = new WebSocket(wsUrl);

    ws.on('open', () => {
        console.log('WebSocket connection established');
        // Start sending ping messages every 30 seconds
        pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send('ping');
            }
        }, 30000);
    });

    ws.on('message', async (data) => {
        const jsonResponse: GenProgressWS = JSON.parse(data.toString());

        if (jsonResponse.data.status === 'FINISHED') {
            // The request has finished processing, so we can find it in the queue and remove it.
            const finishedRequest = serverQueue.get(jsonResponse.id);
            if(!finishedRequest) {
                return console.log(`Received finished REQUEST ${jsonResponse.id} which is not in serverQ.`)
            }
            serverQueue.delete(jsonResponse.id);

            // Create an embed for each image.
            const embeds = [];
            const attachments = [];
            let index = 0;
            for (const imageUrl of jsonResponse.data.images) {
                // Download the image from the URL.
                const image = await axios.get(imageUrl.original, {
                    responseType: 'arraybuffer'
                });

                // Create an attachment from the image.
                const attachment = new AttachmentBuilder(image.data, {
                    name: `image-${index}.png`
                });
                attachments.push(attachment);
                // Create an embed with the image attached.
                const embed = new EmbedBuilder()
                    .setDescription('Here is your image:')
                    .setColor('#0099ff')
                    .setImage(`attachment://image-${index}.png`)
                    .setTimestamp();

                embeds.push(embed);
                index++
            }

            // Send the result back to the user.
            await finishedRequest.interaction.followUp({
                embeds: embeds,
                files: attachments
            });

            // Start processing the next request in the queue.
            processNextRequest();
        } else if (jsonResponse.type == "REQUEST") {
            const localQ = localQueue.get(jsonResponse.id);
            if (localQ) {
                localQueue.delete(jsonResponse.id);
                serverQueue.set(jsonResponse.id, localQ);
                console.log(`Moved REQUEST ${jsonResponse.id} from Local Queue to Server Queue`)
            } else {
                const serverQ = serverQueue.get(jsonResponse.id);
                if(serverQ) {
                    console.log(`Received REQUEST for ${jsonResponse.id} which is not in local queue. Already moved to Server Queue`)
                } else {
                    console.log(`Received REQUEST for ${jsonResponse.id} which is not in local queue.`)
                }
            }
        } else if(jsonResponse.type == "PROGRESS") {
            if(!serverQueue.get(jsonResponse.id)) return;
            console.log(`Update on ${jsonResponse.id} status ${jsonResponse.type} progress ${jsonResponse.data.progress}`)
        }
    });

    ws.on('close', () => {
        console.log('WebSocket connection closed, reconnecting...');
        // Stop sending ping messages
        if (pingInterval) {
            clearInterval(pingInterval);
            pingInterval = null;
        }
        setTimeout(() => startWebSocket(wsUrl), 15000);
    });

    ws.on('error', (err) => {
        console.log('WebSocket error:', err);
    });
}

async function processNextRequest() {
    if (localQueue.size === 0 || serverQueue.size >= maxProcessingCount) return;
    // Get the next request from the queue.
    const [nextId, request] = localQueue.entries().next().value;
    localQueue.delete(nextId);
    console.log(`Processing ${request.GenRequest.prompt}`)

    // Send a request to the API.
    try {
        const response = await axios.post(
            'https://www.unstability.ai/api/submitPrompt',
            request.GenRequest,
            {
                headers: {
                    'cookie': `__Secure-next-auth.session-token=${process.env.SECRET_TOKEN}`,
                },
            }
        );

        const id = response.data.id;
        request.GenRequest.id = id;

        localQueue.set(id, request);
    } catch (error) {
        console.log(`Caught error when processing ${request.GenRequest.prompt} requeueing.`)
        // Re-queue the request at the front.
        localQueue.set(nextId, request);
    }
}

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'queue') {
        const prompt = interaction.options.get("prompt")?.value?.toString();
        const negativePrompt = interaction.options.get('negative_prompt')?.value?.toString();
        const aspectRatio = interaction.options.get('aspect_ratio')?.value?.toString();
        const detail_pass_strength = parseInt(interaction.options.get('high_frequency_detail')?.value as string, 10);
        const lighting_filter_strength = parseInt(interaction.options.get('sampler_strength')?.value as string, 10);
        const saturation = parseInt(interaction.options.get('saturation')?.value as string, 10);
        const count = parseInt(interaction.options.get('count')?.value as string, 10);
        
        const styleGenreCombo = interaction.options.get('style')?.value?.toString();

        const [genre, style] = styleGenreCombo?.split('#') || [];
        
        
    
        const aspectRatioMap: Record<string, { width: number; height: number }> = {
            '3:2': { width: 768, height: 512 },
            '2:3': { width: 512, height: 768 },
            '1:1': { width: 768, height: 768 },
          };
        
        const { width, height } = aspectRatioMap[aspectRatio!] || { width: 768, height: 512 };

        const GenRequest: GenRequest = {
          admin: false,
          alternate_mode: false,
          aspect_ratio: aspectRatio!,
          count: count || 1,
          detail_pass_strength: detail_pass_strength || 50,
          fast: false,
          genre: genre || "digital-art",
          height: height,
          lighting_filter: "chaotic-composition",
          lighting_filter_color: "#000000",
          lighting_filter_negative_color: "#ebebeb",
          lighting_filter_strength: lighting_filter_strength || 50,
          negative_prompt: negativePrompt!,
          prompt: prompt!,
          saturation: saturation || 50,
          style: style || "digital-art",
          width: width,
        };

        localQueue.set(Date.now().toString(), { interaction: interaction, GenRequest: GenRequest });

        await interaction.reply('Your request has been queued!');
        processNextRequest()
    }
});


client.on('ready', async () => {
    console.log(`Logged in as ${client.user?.username}`)
    await registerSlashCommand();
  });

client.login(process.env.DISCORD_TOKEN);