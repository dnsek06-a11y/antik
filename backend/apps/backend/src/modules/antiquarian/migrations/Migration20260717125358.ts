import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260717125358 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "item_details" ("id" text not null, "condition" text check ("condition" in ('mint', 'vg_plus', 'vg', 'good', 'fair')) not null, "category_type" text check ("category_type" in ('vinyl', 'book')) not null, "creator" text not null, "year" integer null, "publisher_or_label" text null, "discogs_release_id" text null, "isbn" text null, "language" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "item_details_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_item_details_deleted_at" ON "item_details" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "item_details" cascade;`);
  }

}
