// src/index.ts

import {
    Client,
    IntentsBitField,
    ApplicationCommandData,
    ChannelType,
  } from 'discord.js';
  import { config } from 'dotenv';
  import * as commands from './Commands';
  import * as Types from './Types';
  import logger from './Logger';
  import { AccountManager } from './ApiClient';
  
  logger.level = 'debug';
  
  const slashCommands: ApplicationCommandData[] = [
    commands.clearCommand,
    commands.queueCommand,
  ];
  
  config();
  
  const client = new Client({
    intents: [
      1,
      IntentsBitField.Flags.Guilds,
      IntentsBitField.Flags.GuildMessages,
    ],
  });
  


  const accountManager = new AccountManager([{
    token: "12361631283",
    maxProcessingCount: 3,
  }]);
  
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;
  
    const { commandName } = interaction;
  
    if (commandName === 'queue') {
      const prompt = interaction.options.get("prompt")?.value?.toString() as string;
      const negativePrompt = interaction.options.get('negative_prompt')?.value?.toString();
      const aspectRatio = interaction.options.get('aspect_ratio')?.value?.toString() || "1:1";
      const fast = interaction.options.get('turbo')?.value as boolean;
      const detail_pass_strength = parseInt(interaction.options.get('high_frequency_detail')?.value as string, 10);
      const lighting_filter_strength = parseInt(interaction.options.get('sampler_strength')?.value as string, 10);
      const saturation = parseInt(interaction.options.get('saturation')?.value as string, 10);
      const count = parseInt(interaction.options.get('count')?.value as string, 10);
      
      const styleGenreCombo = interaction.options.get('style')?.value?.toString();

      const [genre, style] = styleGenreCombo?.split('#') || [];
      
      
  
      const aspectRatioMap: Record<string, { width: number; height: number }> = {
          '3:2': { width: 768, height: 512 },
          '2:3': { width: 512, height: 768 },
          '1:1': { width: 640, height: 640 },
        };
      
      const { width, height } = aspectRatioMap[aspectRatio] || { width: 640, height: 640 };

      const GenRequest: Types.GenRequest = {
        admin: false,
        alternate_mode: false,
        aspect_ratio: aspectRatio,
        count: count || 1,
        detail_pass_strength: detail_pass_strength || 50,
        fast: fast || false,
        genre: genre || "digital-art",
        height: height,
        lighting_filter: "chaotic-composition",
        lighting_filter_color: "#000000",
        lighting_filter_negative_color: "#ebebeb",
        lighting_filter_strength: lighting_filter_strength || 50,
        negative_prompt: negativePrompt || "bad hands, horrible fingers, multiple fingers, mutated fingers, fake, painted, 3d, drawn, blurry, ugly, hideous, disgusting, gross, jpeg artifacts, distortion, grainy, Horrible, messy, unbalanced, (fake, drawn), hideous, disgusting, gross, nausea, broken, in pieces",
        prompt: prompt,
        saturation: saturation || 50,
        style: style || "digital-art",
        width: width,
      };
  
      // Pass the interaction and settings to the account manager
      accountManager.addToQueue({ interaction, GenRequest });
    } else if (commandName === 'clear') {
      // Bulk delete previous messages in the channel
      const channel = interaction.channel;
      if (!channel || channel.type === ChannelType.DM) return;
  
      try {
        const fetchedMessages = await channel.messages.fetch({ limit: 100 });
        await channel.bulkDelete(fetchedMessages);
        await interaction.reply('Bye bye messages x.x.');
      } catch (error) {
        console.error('Failed to delete messages:', error);
        await interaction.reply('Failed to delete messages.' + error);
      }
    }
  });
  
  // Handle account manager event
  accountManager.on('imageReady', async ({ interaction, embeds, attachments }) => {
    await interaction.followUp({ embeds, files: attachments });
  });
  
  client.on('ready', async () => {
    logger.warn(`Logged in as ${client.user?.username}`);
    await registerSlashCommands(client);
  });
  
  client.login(process.env.DISCORD_TOKEN);
  
  async function registerSlashCommands(client: Client) {
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
  
      for (const command of slashCommands) {
        const existingCommand = existingCommands.find(c => c.name === command.name);
        if (!existingCommand) {
          await guild.commands.create(command);
          console.log(`Slash command "${command.name}" created successfully!`);
        } else {
          await existingCommand.edit(command);
          console.log(`Slash command "${command.name}" edited successfully!`);
        }
      }
    } catch (error) {
      console.error('Failed to register slash commands:', error);
    }
  }