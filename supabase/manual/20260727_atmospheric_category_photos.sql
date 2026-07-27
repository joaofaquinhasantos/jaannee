-- JaanNee: initial Atmospheric Noir category reference photos.
-- EXISTING LIVE DATABASE ONLY.
-- MANUAL EXECUTION REQUIRED. This file has not been executed by Codex.
--
-- These are ordinary category reference_photo_url values. Admins can replace
-- or remove every image from Admin > Taxonomy. Re-running this script will not
-- overwrite an image that an admin has already selected.

BEGIN;

UPDATE public.categories
SET reference_photo_url = 'https://lh3.googleusercontent.com/aida-public/AB6AXuDnvSZog7bm61qTcUfXiDPfnGaEOQeCAHwzoIN_-smi-asbRnq_KhM2VGQ_8sdvAj8s6_yFcr50An8DgWmdVFanbiF0dMX1r93vZQyjDO6iT_ogfolUGg5y0nM0fLKDLW9erK03aiYhoRRae4JUZtqKSw35kFn6SS4uuq2t3iCLUNtWmJAqv3yVMyEMavDeWDPOrnBL_Istuz0DG-kcAGbSU0u08e52ivvabmLu0m-PEyyaAnF1e-xyqDBS1SujF6FB_mLfw3E0Jso'
WHERE slug = 'pad-kra-pao'
  AND reference_photo_url IS NULL;

UPDATE public.categories
SET reference_photo_url = 'https://lh3.googleusercontent.com/aida-public/AB6AXuDq4IR5YCM8SsKxHQJsGSbKZk2vb1oj_XgqKepDAWS56yukWM8SnnhsUXGMLOhjGq3gOMdXnQQBnmAaofkpLu9ALEpCLg3TcbwHu8yctz8xgxSXSshnJCJ1yOmWei_2dfXUbwFvAV76ZjrumcQdZEwKB1XVLIrh260_43is3NhBg_8j46LvhfgOfhq21xuRBSJhuWH17jZ06KOYOsMHzRj5phCMEejf6aQ0REnH_TfHFBTlHqSwM56FC4MmqcqdPo6TMU8lEydlEP4'
WHERE slug = 'khao-soi'
  AND reference_photo_url IS NULL;

UPDATE public.categories
SET reference_photo_url = 'https://lh3.googleusercontent.com/aida-public/AB6AXuCbP4VExbhBxP3fjF85AWMvULefSw6EGGVh7HfXlh0gyMVlH5GKuVQpFfs_n-8uyLSauNTJeK1sgNCiEhjD-PjU7UUvd1nfKiWBYTBfpdPw9z-JINdrcu5dgtiUZyJPM3qFLLTP4mttk2qMhVPOO-hNAP82d7WbOfVYWwomAfThU2T_vh-hM3ZIfK-4qYznkDfoAENQ3QcOarDNW-F6XUFd_yyH42u5Nyvk6CgH8JsGTsCSFGzEN20LdsIdEayf6p6Go6FXkQbOL5k'
WHERE slug = 'tom-yum'
  AND reference_photo_url IS NULL;

COMMIT;
