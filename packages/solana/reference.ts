import { z } from 'zod';
import { bytes32 } from './client.js';
import { canonical } from '../policy/src/index.js';
export const DatasetInput = z.object({ dataset:z.enum(['basic','premium']), topic:z.string().min(3).max(500) }).strict();
export const serviceScope = (dataset:string,topic:string) => bytes32(canonical({ service:'reference-v1',dataset,topic }));
export const deliveryMessage = (policy:string,purchase:string,dataset:string,topic:string) => Buffer.from(canonical({policy,purchase,dataset,topic}));
