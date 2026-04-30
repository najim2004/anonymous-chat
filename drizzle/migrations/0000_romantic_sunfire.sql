CREATE TABLE "messages" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"room_id" varchar(32) NOT NULL,
	"user_id" varchar(32) NOT NULL,
	"content" varchar(1000) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"name" varchar(32) NOT NULL,
	"created_by_id" varchar(32) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"username" varchar(24) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "messages_room_created_at_idx" ON "messages" USING btree ("room_id","created_at");--> statement-breakpoint
CREATE INDEX "messages_user_idx" ON "messages" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rooms_name_unique" ON "rooms" USING btree ("name");--> statement-breakpoint
CREATE INDEX "rooms_created_by_idx" ON "rooms" USING btree ("created_by_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_unique" ON "users" USING btree ("username");