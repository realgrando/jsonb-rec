/**
 * JSONB-REC
 * Hybrid PostgreSQL JSONB dynamic schema and EAV validation engine with strict runtime
 * type checking, anti-JSON-bomb defense, and semantic audit diffing.
 * 
 * @author Gustavo Grando (@realgrando)
 * @license MIT
 */

// Domain contracts and ports
export * from './interfaces';

// Core Engine, Runtime Validator, Diffing Algorithm & Key Slugifier
export * from './core/engine';
export * from './core/validator';
export * from './core/diff-engine';
export * from './core/slugify';

// In-Memory Storage Adapter (Zero-dependency local runtime)
export * from './adapters/memory/memory-field-storage';

// Drizzle ORM PostgreSQL Adapter
export * from './adapters/drizzle';

// NestJS Dynamic Module & Decorator Adapter
export * from './adapters/nestjs';
