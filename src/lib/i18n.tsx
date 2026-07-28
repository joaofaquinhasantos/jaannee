import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "th";

export const dict = {
  cuisine_thai: { en: "Thai", th: "ไทย" },
  cuisine_italian: { en: "Italian", th: "อิตาเลียน" },
  cuisine_japanese: { en: "Japanese", th: "ญี่ปุ่น" },
  cuisine_western: { en: "Western", th: "ตะวันตก" },
  cuisine_dessert_cafe: { en: "Dessert & cafe", th: "ขนมและคาเฟ่" },
  cuisine_other: { en: "Other", th: "อื่นๆ" },
  search_categories: { en: "Search English, Thai, or slug", th: "ค้นหาชื่ออังกฤษ ไทย หรือ slug" },
  no_matching_categories: { en: "No matching categories.", th: "ไม่พบหมวดที่ตรงกัน" },
  add_new_place: { en: "Add a new place", th: "เพิ่มร้านใหม่" },
  selected_place: { en: "Selected", th: "เลือกแล้ว" },
  choose_area: { en: "Choose area", th: "เลือกย่าน" },
  filter_categories: { en: "Filter categories", th: "กรองหมวด" },
  filter_areas: { en: "Filter areas", th: "กรองย่าน" },
  cuisine: { en: "Cuisine", th: "ประเภทอาหาร" },
  brand: { en: "JaanNee", th: "จานนี้" },
  tagline: { en: "Rank the dish, not the restaurant.", th: "จัดอันดับที่จาน ไม่ใช่ที่ร้าน" },
  nav_feed: { en: "Discover", th: "ค้นพบ" },
  nav_rankings: { en: "Rankings", th: "อันดับ" },
  nav_compare: { en: "Compare", th: "เปรียบเทียบ" },
  nav_submit: { en: "Add a dish", th: "เพิ่มจาน" },
  nav_profile: { en: "My dishes", th: "จานของฉัน" },
  nav_admin: { en: "Admin", th: "ผู้ดูแล" },
  sign_in: { en: "Sign in", th: "เข้าสู่ระบบ" },
  sign_out: { en: "Sign out", th: "ออกจากระบบ" },
  auth_kicker: { en: "Join the board", th: "ร่วมสร้างอันดับ" },
  auth_intro: {
    en: "We'll email you a magic link. No password needed.",
    th: "เราจะส่งลิงก์เข้าสู่ระบบให้ทางอีเมล โดยไม่ต้องใช้รหัสผ่าน",
  },
  auth_check_inbox: { en: "Check your inbox", th: "ตรวจสอบกล่องจดหมาย" },
  auth_check_inbox_body: {
    en: "Open the link on this device to finish signing in.",
    th: "เปิดลิงก์บนอุปกรณ์นี้เพื่อเข้าสู่ระบบให้เสร็จสมบูรณ์",
  },
  auth_sending: { en: "Sending…", th: "กำลังส่ง…" },
  auth_email_link: { en: "Email me a link", th: "ส่งลิงก์ทางอีเมล" },
  auth_or: { en: "or", th: "หรือ" },
  auth_opening_google: { en: "Opening Google…", th: "กำลังเปิด Google…" },
  auth_google: { en: "Continue with Google", th: "ดำเนินการต่อด้วย Google" },
  filter_all_categories: { en: "All categories", th: "ทุกหมวด" },
  filter_all_areas: { en: "All areas", th: "ทุกย่าน" },
  more_categories: { en: "More categories", th: "หมวดเพิ่มเติม" },
  change_category: { en: "Change category", th: "เปลี่ยนหมวด" },
  more_areas: { en: "More areas", th: "ย่านเพิ่มเติม" },
  search_areas: { en: "Search area name or slug", th: "ค้นหาชื่อย่านหรือ slug" },
  no_matching_areas: { en: "No matching areas.", th: "ไม่พบย่านที่ตรงกัน" },
  status_new: { en: "New contender", th: "ผู้ท้าชิงหน้าใหม่" },
  status_gathering: { en: "Gathering Comparisons", th: "กำลังรวบรวมข้อมูล" },
  gathering_progress: { en: "Gathering comparisons", th: "กำลังรวบรวมข้อมูล" },
  comparisons_progress: { en: "comparisons", th: "การเปรียบเทียบ" },
  not_ranked_yet: {
    en: "Not ranked yet — compare dishes you've tried to build this ranking",
    th: "ยังไม่จัดอันดับ — เปรียบเทียบจานที่คุณเคยกินเพื่อสร้างอันดับนี้",
  },
  tried_by: { en: "Tried by", th: "เคยกินโดย" },
  youve_tried_too: { en: "You've tried", th: "คุณเคยกิน" },
  which_was_better: { en: "too — which dish did you prefer?", th: "ด้วย — คุณชอบจานไหนมากกว่า" },
  status_top: { en: "Top Contender", th: "จานตัวเต็ง" },
  status_ranked: { en: "Ranked", th: "จัดอันดับแล้ว" },
  status_needs_update: { en: "Needs an Update", th: "ต้องอัปเดต" },
  added_ago: { en: "Added", th: "เพิ่มเมื่อ" },
  days_ago: { en: "days ago", th: "วันที่แล้ว" },
  compared_by: { en: "Compared by", th: "เปรียบเทียบโดย" },
  diner: { en: "diner", th: "คน" },
  diners: { en: "diners", th: "คน" },
  tried_it: { en: "I've tried this", th: "เคยกินแล้ว" },
  tried_marked: { en: "Tried ✓", th: "กินแล้ว ✓" },
  compare_this: { en: "Compare this dish", th: "เปรียบเทียบจานนี้" },
  report: { en: "Report", th: "แจ้งปัญหา" },
  price: { en: "Price", th: "ราคา" },
  thb: { en: "THB", th: "บาท" },
  empty_feed: { en: "No dishes yet. Be the first to add one.", th: "ยังไม่มีจาน มาเพิ่มเป็นคนแรก" },
  loading: { en: "Loading…", th: "กำลังโหลด…" },
  share: { en: "Share", th: "แชร์" },
  create_food_post: { en: "Create food post", th: "สร้างโพสต์อาหาร" },
  food_post_title: { en: "Make this your food post", th: "สร้างโพสต์อาหารของคุณ" },
  food_post_body: {
    en: "Create a branded image for Instagram Stories, feed posts, or anywhere you share food.",
    th: "สร้างภาพสำหรับ Instagram Story โพสต์ฟีด หรือแชร์จานนี้ได้ทุกที่",
  },
  food_post_find: { en: "Food find", th: "จานน่าลอง" },
  food_post_tried: { en: "What I ate", th: "จานที่ฉันกิน" },
  food_post_saved: { en: "On my list", th: "จานที่อยากลอง" },
  food_post_hint: {
    en: "Choose the message, then share or download the format you need.",
    th: "เลือกข้อความ แล้วแชร์หรือดาวน์โหลดขนาดที่ต้องการ",
  },
  hero_title: {
    en: "Find the best version of every dish.",
    th: "หาจานที่ดีที่สุดของแต่ละเมนู",
  },
  hero_copy: {
    en: "Discover local dishes, compare dish against dish, and add the gems missing from the map.",
    th: "ค้นหาจานเด็ด เปรียบเทียบจานต่อจาน และเพิ่มร้านที่ยังไม่มีในแผนที่",
  },
  cta_compare: { en: "Compare dishes", th: "เปรียบเทียบจาน" },
  cta_add: { en: "Add a dish", th: "เพิ่มจาน" },
  how_title: { en: "How JaanNee works", th: "JaanNee ทำงานอย่างไร" },
  how_discover: { en: "Discover dishes by category and area.", th: "ค้นหาจานตามหมวดหมู่และย่าน" },
  how_compare: {
    en: "Compare two dishes you have tried and choose the one you prefer.",
    th: "เปรียบเทียบสองจานที่คุณเคยกิน แล้วเลือกจานที่คุณชอบมากกว่า",
  },
  how_submit: {
    en: "Submit missing dishes so the rankings get sharper.",
    th: "เพิ่มจานที่ยังไม่มีเพื่อให้อันดับแม่นขึ้น",
  },
  empty_feed_title: {
    en: "The board is waiting for its first dishes.",
    th: "กระดานนี้กำลังรอจานแรก",
  },
  empty_feed_body: {
    en: "Add a dish or clear filters to start building the ranking.",
    th: "เพิ่มจานหรือล้างตัวกรองเพื่อเริ่มสร้างอันดับ",
  },
  rankings_intro: {
    en: "A dish receives a public rank after at least 5 diner comparisons within the same dish type.",
    th: "จานจะได้รับอันดับสาธารณะเมื่อมีการเปรียบเทียบจากนักชิมอย่างน้อย 5 ครั้งภายในประเภทจานเดียวกัน",
  },
  provisional: { en: "Provisional", th: "ชั่วคราว" },
  trusted_rank: { en: "Trusted rank", th: "อันดับน่าเชื่อถือ" },
  empty_rankings_title: { en: "No ranked dishes here yet.", th: "ยังไม่มีอันดับในหมวดนี้" },
  empty_rankings_body: {
    en: "Add dishes or compare existing ones to bring this board to life.",
    th: "เพิ่มจานหรือเปรียบเทียบจานที่มีเพื่อให้กระดานนี้เริ่มมีชีวิต",
  },
  compare_intro: {
    en: "Choose two dishes you have personally tried and select the one you prefer.",
    th: "เลือกสองจานที่คุณเคยกินด้วยตัวเอง แล้วเลือกจานที่คุณชอบมากกว่า",
  },
  choose_category: { en: "Choose category", th: "เลือกหมวดหมู่" },
  pick_dish: { en: "Pick a dish", th: "เลือกจาน" },
  which_better: { en: "Which dish do you prefer?", th: "คุณชอบจานไหนมากกว่า" },
  compare_empty: {
    en: "This category needs at least two approved dishes before comparisons can start.",
    th: "หมวดนี้ต้องมีจานที่อนุมัติแล้วอย่างน้อยสองจานก่อนเริ่มเปรียบเทียบ",
  },
  sign_in_compare: { en: "Sign in to compare dishes.", th: "เข้าสู่ระบบเพื่อเปรียบเทียบจาน" },
  comparison_saved: { en: "Comparison saved", th: "บันทึกการเปรียบเทียบแล้ว" },
  submit_required: { en: "Fill required fields", th: "กรอกข้อมูลที่จำเป็นให้ครบ" },
  submit_done_title: { en: "Submitted. Thank you.", th: "ส่งแล้ว ขอบคุณ" },
  submit_done_body: {
    en: "Your dish is pending review. It will appear once approved.",
    th: "จานของคุณรอตรวจสอบ และจะแสดงเมื่ออนุมัติแล้ว",
  },
  back_to_feed: { en: "Back to feed", th: "กลับไปหน้าค้นพบ" },
  add_another: { en: "Add another", th: "เพิ่มอีกจาน" },
  duplicate_title: { en: "Is this one of these?", th: "ใช่รายการเหล่านี้ไหม" },
  duplicate_body: {
    en: "We found similar entries. Please check before adding.",
    th: "เราพบรายการใกล้เคียง กรุณาตรวจดูก่อนเพิ่ม",
  },
  back_to_edit: { en: "Back to edit", th: "กลับไปแก้ไข" },
  submit_anyway: { en: "None of these. Submit anyway", th: "ไม่ใช่รายการเหล่านี้ ส่งต่อ" },
  submit_for_review: { en: "Submit for review", th: "ส่งให้ตรวจสอบ" },
  ranked_dishes: { en: "Ranked dishes", th: "จานที่จัดอันดับแล้ว" },
  ranked_dishes_body: {
    en: "Based on at least 5 diner comparisons.",
    th: "จากการเปรียบเทียบของนักชิมอย่างน้อย 5 ครั้ง",
  },
  new_contenders: { en: "New contenders", th: "ผู้ท้าชิงหน้าใหม่" },
  new_contenders_body: {
    en: "These dishes need more diner comparisons before receiving a public rank.",
    th: "จานเหล่านี้ต้องการการเปรียบเทียบเพิ่มเติมก่อนได้รับอันดับสาธารณะ",
  },
  no_ranked_yet_title: {
    en: "No dishes are ranked yet",
    th: "ยังไม่มีจานที่ได้รับอันดับ",
  },
  no_ranked_yet_body: {
    en: "These contenders need at least 5 diner comparisons before receiving a public rank.",
    th: "ผู้ท้าชิงเหล่านี้ต้องการการเปรียบเทียบของนักชิมอย่างน้อย 5 ครั้งก่อนได้รับอันดับสาธารณะ",
  },
  unranked_label: { en: "New contender", th: "ผู้ท้าชิงหน้าใหม่" },
  head_to_head: { en: "Head to head", th: "ตัวต่อตัว" },
  compare_page_intro: {
    en: "Compare only dishes you have personally tried, within the same category and dish type.",
    th: "เปรียบเทียบเฉพาะจานที่คุณเคยกินเอง ภายในหมวดและประเภทจานเดียวกัน",
  },
  sign_in_to_compare: { en: "Sign in to compare dishes", th: "เข้าสู่ระบบเพื่อเปรียบเทียบจาน" },
  sign_in_compare_body: {
    en: "Comparisons are based on dishes you have personally tried. Sign in to continue.",
    th: "การเปรียบเทียบใช้จานที่คุณเคยกินเอง เข้าสู่ระบบเพื่อดำเนินการต่อ",
  },
  preselect_not_tried: {
    en: "That dish must be marked as tried before it can be compared.",
    th: "ต้องทำเครื่องหมายว่าเคยกินจานนี้ก่อนจึงจะเปรียบเทียบได้",
  },
  loading_tried: { en: "Loading your tried dishes…", th: "กำลังโหลดจานที่คุณเคยกิน…" },
  tried_load_error: {
    en: "We couldn't load your tried dishes.",
    th: "เราไม่สามารถโหลดจานที่คุณเคยกินได้",
  },
  try_again: { en: "Try again", th: "ลองอีกครั้ง" },
  no_tried_yet: { en: "No tried dishes yet", th: "ยังไม่มีจานที่เคยกิน" },
  mark_tried_before_compare: {
    en: "Mark dishes as tried before comparing them.",
    th: "ทำเครื่องหมายว่าเคยกินจานก่อนที่จะเปรียบเทียบ",
  },
  discover_dishes: { en: "Discover dishes", th: "ค้นพบจาน" },
  choose_dish_type_first: { en: "Choose a dish type first", th: "เลือกประเภทจานก่อน" },
  same_dish_type_only: {
    en: "Comparisons only happen between the same actual dish type.",
    th: "การเปรียบเทียบเกิดขึ้นเฉพาะระหว่างประเภทจานเดียวกันเท่านั้น",
  },
  need_two_tried: { en: "You need two tried dishes", th: "คุณต้องมีจานที่เคยกินสองจาน" },
  need_two_tried_body: {
    en: "Mark at least two dishes as tried in this category and dish type before comparing them.",
    th: "ทำเครื่องหมายอย่างน้อยสองจานว่าเคยกินในหมวดและประเภทจานนี้ก่อนเปรียบเทียบ",
  },
  discover_more_dishes: { en: "Discover more dishes", th: "ค้นพบจานเพิ่มเติม" },
  dish_a: { en: "Dish A", th: "จาน A" },
  dish_b: { en: "Dish B", th: "จาน B" },
  profile_posts: { en: "Posts", th: "โพสต์" },
  profile_tried: { en: "Tried", th: "เคยกิน" },
  profile_comparisons: { en: "Comparisons", th: "การเปรียบเทียบ" },
  profile_history_body: {
    en: "Your posts, tried dishes, and comparison history.",
    th: "โพสต์ จานที่คุณเคยกิน และประวัติการเปรียบเทียบของคุณ",
  },

  // --- Discover / hero ---
  discover_bangkok: { en: "Discover Bangkok", th: "ค้นพบกรุงเทพฯ" },
  featured_category: { en: "Featured category", th: "หมวดแนะนำ" },
  explore_category: { en: "Explore category", th: "ดูหมวดนี้" },
  no_dishes_for_filters: {
    en: "No dishes match these filters",
    th: "ไม่พบจานที่ตรงกับตัวกรอง",
  },
  no_dishes_for_filters_body: {
    en: "Try another category or area, or add an individual dish you have tried.",
    th: "ลองเลือกหมวดหรือย่านอื่น หรือเพิ่มจานที่คุณเคยกิน",
  },
  photo_needed: { en: "Photo needed", th: "ต้องการรูปภาพ" },
  photo_needed_body: { en: "Help this dish look alive", th: "ช่วยเพิ่มรูปให้จานนี้" },
  add_the_first_dish: { en: "Add the first dish", th: "เพิ่มจานแรก" },
  section_top_ranked: { en: "Current leaders", th: "ผู้นำอันดับ" },
  section_top_ranked_body: {
    en: "Ranked from at least 5 diner comparisons in the same dish type.",
    th: "จัดอันดับจากการเปรียบเทียบของนักชิมอย่างน้อย 5 ครั้งในประเภทจานเดียวกัน",
  },
  section_almost_ranked: { en: "Almost ranked", th: "ใกล้ได้อันดับ" },
  section_almost_ranked_body: {
    en: "A few more diner comparisons and these get a public rank.",
    th: "อีกไม่กี่การเปรียบเทียบ จานเหล่านี้จะได้อันดับสาธารณะ",
  },
  section_recent: { en: "Recently added", th: "เพิ่มล่าสุด" },
  section_recent_body: {
    en: "Freshly approved dishes waiting for their first comparisons.",
    th: "จานที่เพิ่งได้รับอนุมัติ กำลังรอการเปรียบเทียบครั้งแรก",
  },
  choose_dish_type: { en: "Choose a dish type", th: "เลือกประเภทจาน" },
  choose_dish_type_body: {
    en: "Rankings stay inside one dish type, so pick the one you want to see.",
    th: "การจัดอันดับอยู่ภายในประเภทจานเดียว เลือกประเภทที่ต้องการดู",
  },
  show_more: { en: "Show more", th: "แสดงเพิ่มเติม" },
  reset_filters: { en: "Reset filters", th: "ล้างตัวกรอง" },
  close: { en: "Close", th: "ปิด" },
  cancel: { en: "Cancel", th: "ยกเลิก" },
  not_now: { en: "Not now", th: "ไว้ก่อน" },
  done: { en: "Done", th: "เสร็จสิ้น" },
  error_generic: { en: "Something went wrong.", th: "เกิดข้อผิดพลาด" },

  // --- Trust / how it works ---
  how_ranking_works: { en: "How this ranking works", th: "อันดับนี้ทำงานอย่างไร" },
  how_rule_tried: {
    en: "A diner must have personally tried both dishes before comparing them.",
    th: "นักชิมต้องเคยกินทั้งสองจานด้วยตัวเองก่อนจึงจะเปรียบเทียบได้",
  },
  how_rule_pool: {
    en: "Comparisons only ever happen inside the same dish type.",
    th: "การเปรียบเทียบเกิดขึ้นภายในประเภทจานเดียวกันเท่านั้น",
  },
  how_rule_no_pay: {
    en: "Restaurants cannot vote, and ranking position is never for sale.",
    th: "ร้านอาหารโหวตไม่ได้ และตำแหน่งอันดับไม่มีวันขาย",
  },
  how_rule_threshold: {
    en: "A public numeric rank needs at least 5 diner comparisons.",
    th: "อันดับตัวเลขสาธารณะต้องมีการเปรียบเทียบจากนักชิมอย่างน้อย 5 ครั้ง",
  },

  // --- Contextual comparison ---
  ready_to_compare: { en: "Ready to compare", th: "พร้อมเปรียบเทียบ" },
  ready_to_compare_body: {
    en: "You have tried both of these. Which did you prefer?",
    th: "คุณเคยกินทั้งสองจานนี้ คุณชอบจานไหนมากกว่า",
  },
  no_pairs_yet: { en: "No pair ready yet", th: "ยังไม่มีคู่ที่พร้อม" },
  no_pairs_yet_body: {
    en: "Mark two dishes of the same dish type as tried to unlock a comparison.",
    th: "ทำเครื่องหมายว่าเคยกินสองจานในประเภทเดียวกันเพื่อปลดล็อกการเปรียบเทียบ",
  },
  i_prefer_this: { en: "I prefer this", th: "ฉันชอบจานนี้" },
  saving: { en: "Saving…", th: "กำลังบันทึก…" },

  // --- Sharing ---
  share_result: { en: "Share this result", th: "แชร์ผลลัพธ์นี้" },
  share_ranking: { en: "Share ranking", th: "แชร์อันดับ" },
  copy_link: { en: "Copy link", th: "คัดลอกลิงก์" },
  link_copied: { en: "Link copied", th: "คัดลอกลิงก์แล้ว" },
  download_story: { en: "Download story", th: "ดาวน์โหลดสตอรี" },
  download_post: { en: "Download post", th: "ดาวน์โหลดโพสต์" },
  download_square: { en: "Download square", th: "ดาวน์โหลดสี่เหลี่ยม" },
  image_saved: { en: "Image saved", th: "บันทึกรูปแล้ว" },
  image_failed: { en: "Could not create the image.", th: "ไม่สามารถสร้างรูปได้" },
  do_you_agree: { en: "Do you agree?", th: "คุณเห็นด้วยไหม" },
  you_picked: { en: "You picked", th: "คุณเลือก" },

  // --- Challenge ---
  challenge_title: { en: "Head-to-head challenge", th: "ท้าดวลจานต่อจาน" },
  challenge_intro: {
    en: "Someone picked a winner. Try both dishes and cast your own comparison.",
    th: "มีคนเลือกจานที่ชอบแล้ว ลองกินทั้งสองจานแล้วเปรียบเทียบด้วยตัวคุณเอง",
  },
  challenge_unavailable: { en: "This challenge is not available", th: "ไม่พบการท้าดวลนี้" },
  challenge_unavailable_body: {
    en: "Both dishes must be approved and in the exact same dish type.",
    th: "ทั้งสองจานต้องได้รับอนุมัติและอยู่ในประเภทจานเดียวกัน",
  },
  challenge_sign_in: {
    en: "Sign in to add your own comparison.",
    th: "เข้าสู่ระบบเพื่อเพิ่มการเปรียบเทียบของคุณ",
  },
  challenge_mark_tried: {
    en: "Mark both dishes as tried to take part.",
    th: "ทำเครื่องหมายว่าเคยกินทั้งสองจานเพื่อร่วมเปรียบเทียบ",
  },
  challenge_agree: { en: "You agreed with the sharer.", th: "คุณเห็นด้วยกับผู้แชร์" },
  challenge_disagree: { en: "You disagreed with the sharer.", th: "คุณไม่เห็นด้วยกับผู้แชร์" },
  their_pick: { en: "Their pick", th: "จานที่เขาเลือก" },

  // --- Activation ---
  activation_title: { en: "Which dishes have you tried?", th: "คุณเคยกินจานไหนบ้าง" },
  activation_body: {
    en: "Tap the ones you know. Sign in afterwards and we will save them to your account.",
    th: "แตะจานที่คุณเคยกิน เข้าสู่ระบบแล้วเราจะบันทึกไว้ในบัญชีของคุณ",
  },
  activation_save: { en: "Save my tried dishes", th: "บันทึกจานที่เคยกิน" },
  activation_saved: { en: "Saved to your account", th: "บันทึกลงบัญชีของคุณแล้ว" },
  dismiss: { en: "Dismiss", th: "ปิดไว้" },
  selected_count: { en: "selected", th: "เลือกแล้ว" },

  // --- Add a dish ---
  dish_name: { en: "Dish name", th: "ชื่อจาน" },
  dish_name_th: { en: "Dish name (Thai)", th: "ชื่อจาน (ไทย)" },
  dish_name_en: { en: "Dish name (English)", th: "ชื่อจาน (อังกฤษ)" },
  more_details: { en: "More details", th: "รายละเอียดเพิ่มเติม" },
  optional: { en: "Optional", th: "ไม่บังคับ" },

  // --- Profile ---
  profile_submitted: { en: "Submitted dishes", th: "จานที่ส่งไว้" },
  want_to_try: { en: "Want to try", th: "อยากลอง" },
  want_to_try_body: {
    en: "Save dishes for your next meal. Saving never affects rankings.",
    th: "บันทึกจานไว้สำหรับมื้อต่อไป การบันทึกไม่มีผลต่ออันดับ",
  },
  saved_for_later: { en: "Saved for later", th: "บันทึกไว้แล้ว" },
  remove_from_saved: { en: "Remove from saved", th: "นำออกจากรายการที่บันทึก" },
  no_saved_dishes: {
    en: "No dishes saved yet. Use Want to try on any dish you would like to visit.",
    th: "ยังไม่มีจานที่บันทึกไว้ กด อยากลอง บนจานที่คุณอยากไปกิน",
  },
  my_jaannee: { en: "My JaanNee", th: "JaanNee ของฉัน" },
  profile_settings: { en: "Profile settings", th: "ตั้งค่าโปรไฟล์" },
  pending_review: { en: "Pending review", th: "รอตรวจสอบ" },
  not_approved: { en: "Not approved", th: "ไม่ผ่านการอนุมัติ" },
};

export type Key = keyof typeof dict;

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: Key) => string;
}
const Ctx = createContext<LangCtx>({ lang: "en", setLang: () => {}, t: (k) => dict[k]?.en ?? k });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  useEffect(() => {
    const saved =
      typeof window !== "undefined" ? (localStorage.getItem("jn_lang") as Lang | null) : null;
    if (saved === "en" || saved === "th") setLangState(saved);
  }, []);
  // Keep <html lang> in sync so screen readers and search engines see the
  // language the diner is actually reading.
  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = lang;
  }, [lang]);
  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") localStorage.setItem("jn_lang", l);
  };
  const t = (k: Key) => dict[k]?.[lang] ?? dict[k]?.en ?? k;
  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);
