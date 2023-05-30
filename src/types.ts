import { CommandInteraction } from "discord.js";

export interface Request {
    interaction: CommandInteraction;
    GenRequest: GenRequest;
  }

export interface GenRequest {
    admin: boolean;
    alternate_mode: boolean;
    aspect_ratio: string;
    count: number;
    detail_pass_strength: number;
    fast: boolean;
    genre: string;
    height: number;
    lighting_filter: string;
    lighting_filter_color: string;
    lighting_filter_negative_color: string;
    lighting_filter_strength: number;
    negative_prompt: string;
    prompt: string;
    saturation: number;
    style: string;
    width: number;
  }
  
export interface GenProgressWS {
    id: string;
    type: string;    
    data: {
      progress: string;
      status: string;
      images: Array<{
        id: string;
        original: string;
      }>;
      fast_credit_cost: number;
      slow_credit_cost: number;
      accepted_at: number;
      finished_at: number;
      requested_at: number;
      count: number;
      fast: boolean;
    };
  }