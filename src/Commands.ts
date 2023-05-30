import { ApplicationCommandData, ApplicationCommandOptionType } from 'discord.js';

export const queueCommand: ApplicationCommandData = {
    name: 'queue',
    description: 'Queue a request',
    options: [
        {
            name: 'prompt',
            type: ApplicationCommandOptionType.String,
            description: 'The prompt for the image',
            required: true,
        },
        {
            name: 'negative_prompt',
            type: ApplicationCommandOptionType.String,
            description: 'The negative prompt for the image (If Skipped a good default is used)',
            required: false,
        },
        {
            name: 'style',
            type: ApplicationCommandOptionType.String,
            description: 'The style of the image',
            required: false,
            choices: [
                {
                    name: 'Digital Art',
                    value: 'digital_art#digital_art',
                },
                {
                    name: 'Photo',
                    value: 'realistic#realistic-photo', // GENRE#STYLE
                },
                {
                    name: 'Generalist',
                    value: 'generalist#generalist',  // GENRE#STYLE
                },
                {
                    name: 'Anime Normal',
                    value: 'anime#anime-base',  // GENRE#STYLE
                },
                {
                    name: 'Anime Degenerate (Anthro)',
                    value: 'anime#anime-anthro',  // GENRE#STYLE
                },]
        },
        {
            name: 'aspect_ratio',
            type: ApplicationCommandOptionType.String,
            description: 'The aspect ratio of the image (2:3, 3:2, or 1:1)',
            required: false,
            choices: [
                {
                    name: '2:3',
                    value: '2:3',
                },
                {
                    name: '3:2',
                    value: '3:2',
                },
                {
                    name: '1:1',
                    value: '1:1',
                },
            ],
        },
        {
            name: 'high_frequency_detail',
            type: ApplicationCommandOptionType.Integer,
            description: 'The High Frequency Detail for the image (between 0 and 100)',
            required: false,
            min_value: 0,
            max_value: 100,
        },
        {
            name: 'sampler_strength',
            type: ApplicationCommandOptionType.Integer,
            description: 'The Sampler Strength for the image (between 0 and 100)',
            required: false,
            min_value: 0,
            max_value: 100,
        },
        {
            name: 'saturation',
            type: ApplicationCommandOptionType.Integer,
            description: 'The saturation of the image (between 0 and 100)',
            required: false,
            min_value: 0,
            max_value: 100,
        },
        {
            name: 'count',
            type: ApplicationCommandOptionType.Integer,
            description: 'Amount of Images to be generated.',
            required: false,
            min_value: 1,
            max_value: 4,
        },
        {
            name: 'turbo',
            type: ApplicationCommandOptionType.Boolean,
            description: 'Turn on Zoomies mode.',
            required: false
        },
    ],
};

export const clearCommand: ApplicationCommandData = {
    name: 'clear',
    description: 'clear chat',
};
