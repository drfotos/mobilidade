-- Migration 000: Enable PostGIS extension (required for geography type)
create extension if not exists postgis;
create extension if not exists "uuid-ossp";
