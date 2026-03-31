import { pgTable, text, timestamp, integer, varchar, boolean, jsonb, index } from 'drizzle-orm/pg-core';

export const artists = pgTable('artists', {
  id: text('id').primaryKey(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  bio: text('bio'),
  imageUrl: text('image_url'),
  genre: varchar('genre', { length: 100 }),
  spotifyId: text('spotify_id'),
  ticketmasterId: text('ticketmaster_id'),
  bandsintownId: text('bandsintown_id'),
  seatgeekId: text('seatgeek_id'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  nameIdx: index('artist_name_idx').on(table.name),
  genreIdx: index('artist_genre_idx').on(table.genre),
  slugIdx: index('artist_slug_idx').on(table.slug),
}));

export const venues = pgTable('venues', {
  id: text('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  city: varchar('city', { length: 100 }),
  state: varchar('state', { length: 50 }),
  country: varchar('country', { length: 100 }),
  address: text('address'),
  postalCode: varchar('postal_code', { length: 20 }),
  latitude: text('latitude'),
  longitude: text('longitude'),
  timezone: varchar('timezone', { length: 50 }),
  capacity: integer('capacity'),
  url: text('url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  cityIdx: index('venue_city_idx').on(table.city),
  nameIdx: index('venue_name_idx').on(table.name),
  stateIdx: index('venue_state_idx').on(table.state),
}));

export const events = pgTable('events', {
  id: text('id').primaryKey(),
  artistId: text('artist_id').notNull().references(() => artists.id, { onDelete: 'cascade' }),
  venueId: text('venue_id').references(() => venues.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 255 }).notNull(),
  eventDate: timestamp('event_date').notNull(),
  status: varchar('status', { length: 50 }).default('scheduled'),
  ticketUrl: text('ticket_url'),
  minPrice: integer('min_price'),
  maxPrice: integer('max_price'),
  currency: varchar('currency', { length: 10 }).default('USD'),
  source: varchar('source', { length: 50 }).notNull(), // 'ticketmaster', 'seatgeek', 'bandsintown'
  externalId: text('external_id').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  artistIdx: index('event_artist_idx').on(table.artistId),
  dateIdx: index('event_date_idx').on(table.eventDate),
  statusIdx: index('event_status_idx').on(table.status),
  sourceExternalIdx: index('event_source_external_idx').on(table.source, table.externalId),
  artistDateIdx: index('event_artist_date_idx').on(table.artistId, table.eventDate),
}));

export const newsArticles = pgTable('news_articles', {
  id: text('id').primaryKey(),
  artistId: text('artist_id').notNull().references(() => artists.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  summary: text('summary'),
  url: text('url').notNull(),
  source: varchar('source', { length: 100 }),
  publishedAt: timestamp('published_at').notNull(),
  imageUrl: text('image_url'),
  author: varchar('author', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  artistIdx: index('news_artist_idx').on(table.artistId),
  publishedIdx: index('news_published_idx').on(table.publishedAt),
  urlIdx: index('news_url_idx').on(table.url),
}));

export const tweets = pgTable('tweets', {
  id: text('id').primaryKey(), // Twitter tweet ID
  artistId: text('artist_id').notNull().references(() => artists.id, { onDelete: 'cascade' }),
  tweetText: text('tweet_text').notNull(),
  twitterHandle: varchar('twitter_handle', { length: 100 }).notNull(),
  tweetUrl: text('tweet_url').notNull(),
  publishedAt: timestamp('published_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  artistIdx: index('tweets_artist_idx').on(table.artistId),
  publishedIdx: index('tweets_published_idx').on(table.publishedAt),
}));

export type Artist = typeof artists.$inferSelect;
export type NewArtist = typeof artists.$inferInsert;
export type Venue = typeof venues.$inferSelect;
export type NewVenue = typeof venues.$inferInsert;
export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type NewsArticle = typeof newsArticles.$inferSelect;
export type NewNewsArticle = typeof newsArticles.$inferInsert;
export type Tweet = typeof tweets.$inferSelect;
export type NewTweet = typeof tweets.$inferInsert;
