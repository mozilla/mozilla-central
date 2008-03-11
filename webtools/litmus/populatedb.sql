-- MySQL dump 10.9
--
-- Host: localhost    Database: litmus
-- ------------------------------------------------------
-- Server version	4.1.22-standard

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8 */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

USE `litmus`;

--
-- Dumping data for table `audit_trail`
--

LOCK TABLES `audit_trail` WRITE;
/*!40000 ALTER TABLE `audit_trail` DISABLE KEYS */;
/*!40000 ALTER TABLE `audit_trail` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `branches`
--

LOCK TABLES `branches` WRITE;
/*!40000 ALTER TABLE `branches` DISABLE KEYS */;
INSERT INTO `branches` (`branch_id`, `product_id`, `name`, `detect_regexp`, `enabled`, `creator_id`, `last_updated`, `creation_date`) VALUES (1,1,'Trunk','',1,1,'2008-03-11 14:10:05','2008-03-11 14:10:05');
/*!40000 ALTER TABLE `branches` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `build_type_lookup`
--

LOCK TABLES `build_type_lookup` WRITE;
/*!40000 ALTER TABLE `build_type_lookup` DISABLE KEYS */;
INSERT INTO `build_type_lookup` (`build_type_id`, `name`) VALUES (1,'Nightly'),(2,'Release'),(3,'CVS Optimized'),(4,'CVS Debug'),(5,'Other');
/*!40000 ALTER TABLE `build_type_lookup` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `exit_status_lookup`
--

LOCK TABLES `exit_status_lookup` WRITE;
/*!40000 ALTER TABLE `exit_status_lookup` DISABLE KEYS */;
INSERT INTO `exit_status_lookup` (`exit_status_id`, `name`) VALUES (1,'Exited Normally'),(2,'Crash'),(3,'Timed Out');
/*!40000 ALTER TABLE `exit_status_lookup` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `group_product_map`
--

LOCK TABLES `group_product_map` WRITE;
/*!40000 ALTER TABLE `group_product_map` DISABLE KEYS */;
/*!40000 ALTER TABLE `group_product_map` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `locale_lookup`
--

LOCK TABLES `locale_lookup` WRITE;
/*!40000 ALTER TABLE `locale_lookup` DISABLE KEYS */;
INSERT INTO `locale_lookup` (`locale_abbrev`, `name`) VALUES ('af-ZA','Afrikaans'),('ar','Arabic'),('ar-JO','Arabic'),('ast-ES','Asturian'),('be-BY','Belarusian'),('bg','Bulgarian'),('bg-BG','Bulgarian'),('ca','Catalan'),('ca-AD','Catalan'),('cs','Czech'),('cs-CZ','Czech'),('cy-GB','Welsh Cymraeg'),('da','Danish'),('da-DK','Danish'),('de','German'),('de-DE','German'),('el','Greek'),('el-GR','Greek'),('en-GB','English, UK'),('es-AR','Spanish, Argentina'),('es-ES','Spanish, Spain'),('eu','Basque'),('eu-ES','Basque'),('fi','Finnish'),('fi-FI','Finnish'),('fr','French'),('fr-FR','French'),('fy-NL','Frisian'),('ga-IE','Irish'),('gu-IN','Gujarati'),('he','Hebrew'),('he-IL','Hebrew'),('hu','Hungarian'),('hu-HU','Hungarian'),('hy-AM','Armenian'),('it','Italian'),('it-IT','Italian'),('ja-JP','Japanese'),('ko','Korean'),('lt','Lithuanian'),('mk','Macedonian'),('mk-MK','Macedonian'),('mn-MN','Mongolian'),('nb-NO','Norwegian bokmal'),('nn-NO','Norwegian Nynorsk'),('nl','Dutch'),('nl-NL','Dutch'),('pa-IN','Punjabi'),('pl','Polish'),('pl-PL','Polish'),('pt-BR','Portuguese, Brazil'),('ro','Romanian'),('ro-RO','Romanian'),('ru','Russian'),('ru-RU','Russian'),('sq','Albanian'),('sq-AL','Albanian'),('sk-SK','Slovak'),('sl','Slovene'),('sl-SI','Slovene'),('sv-SE','Swedish'),('tr-TR','Turkish'),('zh-CN','Chinese Simplified, China'),('zh-TW','Chinese Traditional, Taiwan'),('hi-IN','Hindi'),('hr-HR','Croatian'),('rw-RW','Kinyarwanda'),('km-KH','Khmer'),('ml-IN','Malayalam'),('ne-NP','Nepali'),('si-LK','Singhalese'),('ta-IN','Tamil'),('az','Azeri'),('az-AZ','Azeri'),('bn-BD','Bengali'),('bn-IN','Bengali'),('bi-VU','Bislama, Vanuatu Pidgin'),('bo','Tibetan'),('bo-CN','Tibetan'),('eo','Esperanto'),('es-CL','Spanish, Chile'),('es-MX','Spanish, Mexico'),('en-CA','English, Canada'),('gem-RO-saxon','German'),('gd-GB','Scottish Gaelic'),('gl-ES','Galician'),('gv-IM','Manx Gaelic, Isle of Man'),('id-ID','Indonesian'),('ig-NG','Igbo, Nigeria'),('ilo','Ilokano'),('ilo-PH','Ilokano'),('is','Icelandic'),('is-IS','Icelandic'),('kk-KZ','Kazakh'),('ku','Kurdish'),('ky-KG','Kyrgyz language'),('lo-LA','Lao'),('lv','Latvian'),('mr-IN','Marathi'),('ms-MY','Malay'),('oc-FR','Occitan'),('sw-TZ','Kiswahili'),('te-IN','Telugu'),('tg-TJ','Tajik'),('th-TH','Thai'),('ti-ER','Tigrinya, Eritrea'),('uk-UA','Ukrainian'),('ur-PK','Urdu'),('so','Somali'),('sr','Serbian'),('sr-CS','Serbian'),('sr-BA','Serbian'),('ka-GE','Georgian'),('fa-IR','Persian'),('vi-VN','Vietnamese'),('en-US','English, US'),('ko-KR','Korean'),('ja-JP-mac','Japanese (Mac)'),('ja','Japanese'),('ja-JPM','Japanese (1.0.x Mac)'),('pt-PT','Portuguese, Portugal');
/*!40000 ALTER TABLE `locale_lookup` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `log_type_lookup`
--

LOCK TABLES `log_type_lookup` WRITE;
/*!40000 ALTER TABLE `log_type_lookup` DISABLE KEYS */;
INSERT INTO `log_type_lookup` (`log_type_id`, `name`) VALUES (1,'STDOUT'),(2,'STDERR'),(3,'STDIN'),(4,'Environment variables');
/*!40000 ALTER TABLE `log_type_lookup` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `opsyses`
--

LOCK TABLES `opsyses` WRITE;
/*!40000 ALTER TABLE `opsyses` DISABLE KEYS */;
INSERT INTO `opsyses` (`opsys_id`, `platform_id`, `name`, `detect_regexp`, `last_updated`, `creation_date`, `creator_id`) VALUES (1,1,'Windows 98','','2008-03-11 14:10:05','2008-03-11 14:10:05',1);
/*!40000 ALTER TABLE `opsyses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `password_resets`
--

LOCK TABLES `password_resets` WRITE;
/*!40000 ALTER TABLE `password_resets` DISABLE KEYS */;
/*!40000 ALTER TABLE `password_resets` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `platform_products`
--

LOCK TABLES `platform_products` WRITE;
/*!40000 ALTER TABLE `platform_products` DISABLE KEYS */;
INSERT INTO `platform_products` (`platform_id`, `product_id`) VALUES (1,1);
/*!40000 ALTER TABLE `platform_products` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `platforms`
--

LOCK TABLES `platforms` WRITE;
/*!40000 ALTER TABLE `platforms` DISABLE KEYS */;
INSERT INTO `platforms` (`platform_id`, `name`, `detect_regexp`, `iconpath`, `last_updated`, `creation_date`, `creator_id`) VALUES (1,'Windows','Windows','win.png','2008-03-11 14:10:05','2008-03-11 14:10:05',1);
/*!40000 ALTER TABLE `platforms` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `products`
--

LOCK TABLES `products` WRITE;
/*!40000 ALTER TABLE `products` DISABLE KEYS */;
INSERT INTO `products` (`product_id`, `name`, `iconpath`, `enabled`, `last_updated`, `creation_date`, `creator_id`) VALUES (1,'My Product','',1,'2008-03-11 14:10:05','2008-03-11 14:10:05',1);
/*!40000 ALTER TABLE `products` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `related_testcases`
--

LOCK TABLES `related_testcases` WRITE;
/*!40000 ALTER TABLE `related_testcases` DISABLE KEYS */;
/*!40000 ALTER TABLE `related_testcases` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `security_groups`
--

LOCK TABLES `security_groups` WRITE;
/*!40000 ALTER TABLE `security_groups` DISABLE KEYS */;
INSERT INTO `security_groups` (`group_id`, `name`, `description`, `grouptype`, `isactive`) VALUES (1,'Litmus Super Administrators','Global administrators of this Litmus installation',1,1),(2,'Litmus Test Run/Test Day Administrators','Administrators of Litmus Test Runs and Test Days',2,1);
/*!40000 ALTER TABLE `security_groups` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `sessions`
--

LOCK TABLES `sessions` WRITE;
/*!40000 ALTER TABLE `sessions` DISABLE KEYS */;
/*!40000 ALTER TABLE `sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `subgroup_testgroups`
--

LOCK TABLES `subgroup_testgroups` WRITE;
/*!40000 ALTER TABLE `subgroup_testgroups` DISABLE KEYS */;
INSERT INTO `subgroup_testgroups` (`subgroup_id`, `testgroup_id`, `sort_order`) VALUES (1,1,1);
/*!40000 ALTER TABLE `subgroup_testgroups` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `subgroups`
--

LOCK TABLES `subgroups` WRITE;
/*!40000 ALTER TABLE `subgroups` DISABLE KEYS */;
INSERT INTO `subgroups` (`subgroup_id`, `name`, `enabled`, `product_id`, `branch_id`, `last_updated`, `creation_date`, `creator_id`) VALUES (1,'My Subgroup',1,1,1,'2008-03-11 14:10:05','2008-03-11 14:10:05',1);
/*!40000 ALTER TABLE `subgroups` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `tags`
--

LOCK TABLES `tags` WRITE;
/*!40000 ALTER TABLE `tags` DISABLE KEYS */;
/*!40000 ALTER TABLE `tags` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `test_format_lookup`
--

LOCK TABLES `test_format_lookup` WRITE;
/*!40000 ALTER TABLE `test_format_lookup` DISABLE KEYS */;
INSERT INTO `test_format_lookup` (`format_id`, `name`) VALUES (1,'Manual');
/*!40000 ALTER TABLE `test_format_lookup` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `test_result_bugs`
--

LOCK TABLES `test_result_bugs` WRITE;
/*!40000 ALTER TABLE `test_result_bugs` DISABLE KEYS */;
/*!40000 ALTER TABLE `test_result_bugs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `test_result_comments`
--

LOCK TABLES `test_result_comments` WRITE;
/*!40000 ALTER TABLE `test_result_comments` DISABLE KEYS */;
/*!40000 ALTER TABLE `test_result_comments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `test_result_logs`
--

LOCK TABLES `test_result_logs` WRITE;
/*!40000 ALTER TABLE `test_result_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `test_result_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `test_result_status_lookup`
--

LOCK TABLES `test_result_status_lookup` WRITE;
/*!40000 ALTER TABLE `test_result_status_lookup` DISABLE KEYS */;
INSERT INTO `test_result_status_lookup` (`result_status_id`, `name`, `style`, `class_name`) VALUES (1,'Pass','background-color: #00FF00;','pass'),(2,'Fail','background-color: #FF0000;','fail'),(3,'Test unclear/broken','background-color: #FFFF66;','unclear');
/*!40000 ALTER TABLE `test_result_status_lookup` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `test_results`
--

LOCK TABLES `test_results` WRITE;
/*!40000 ALTER TABLE `test_results` DISABLE KEYS */;
/*!40000 ALTER TABLE `test_results` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `test_run_criteria`
--

LOCK TABLES `test_run_criteria` WRITE;
/*!40000 ALTER TABLE `test_run_criteria` DISABLE KEYS */;
/*!40000 ALTER TABLE `test_run_criteria` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `test_run_testgroups`
--

LOCK TABLES `test_run_testgroups` WRITE;
/*!40000 ALTER TABLE `test_run_testgroups` DISABLE KEYS */;
INSERT INTO `test_run_testgroups` (`test_run_id`, `testgroup_id`, `sort_order`) VALUES (1,1,1);
/*!40000 ALTER TABLE `test_run_testgroups` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `test_runs`
--

LOCK TABLES `test_runs` WRITE;
/*!40000 ALTER TABLE `test_runs` DISABLE KEYS */;
INSERT INTO `test_runs` (`test_run_id`, `name`, `description`, `last_updated`, `creation_date`, `start_timestamp`, `finish_timestamp`, `enabled`, `recommended`, `product_id`, `branch_id`, `author_id`, `version`) VALUES (1,'My Product Catch-All Test Run','This is the baseline, catch-all test run for My Product.','2008-03-11 14:10:05','2008-03-11 14:10:05','2008-03-11 14:10:05','2010-01-01 00:00:00',1,1,1,1,1,1);
/*!40000 ALTER TABLE `test_runs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `testcase_subgroups`
--

LOCK TABLES `testcase_subgroups` WRITE;
/*!40000 ALTER TABLE `testcase_subgroups` DISABLE KEYS */;
INSERT INTO `testcase_subgroups` (`testcase_id`, `subgroup_id`, `sort_order`) VALUES (1,1,1);
/*!40000 ALTER TABLE `testcase_subgroups` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `testcase_tags`
--

LOCK TABLES `testcase_tags` WRITE;
/*!40000 ALTER TABLE `testcase_tags` DISABLE KEYS */;
/*!40000 ALTER TABLE `testcase_tags` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `testcases`
--

LOCK TABLES `testcases` WRITE;
/*!40000 ALTER TABLE `testcases` DISABLE KEYS */;
INSERT INTO `testcases` (`testcase_id`, `summary`, `details`, `enabled`, `community_enabled`, `format_id`, `regression_bug_id`, `steps`, `expected_results`, `author_id`, `last_updated`, `creation_date`, `version`, `product_id`, `branch_id`) VALUES (1,'My Testcase','',1,1,1,NULL,'Start My Product.','My product should start.',1,'2008-03-11 14:10:05','2008-03-11 14:10:05',1,1,1);
/*!40000 ALTER TABLE `testcases` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `testday_subgroups`
--

LOCK TABLES `testday_subgroups` WRITE;
/*!40000 ALTER TABLE `testday_subgroups` DISABLE KEYS */;
/*!40000 ALTER TABLE `testday_subgroups` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `testdays`
--

LOCK TABLES `testdays` WRITE;
/*!40000 ALTER TABLE `testdays` DISABLE KEYS */;
/*!40000 ALTER TABLE `testdays` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `testgroups`
--

LOCK TABLES `testgroups` WRITE;
/*!40000 ALTER TABLE `testgroups` DISABLE KEYS */;
INSERT INTO `testgroups` (`testgroup_id`, `product_id`, `name`, `enabled`, `branch_id`, `last_updated`, `creation_date`, `creator_id`) VALUES (1,1,'My Testgroup',1,1,'2008-03-11 14:10:05','2008-03-11 14:10:05',1);
/*!40000 ALTER TABLE `testgroups` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `testresult_logs_join`
--

LOCK TABLES `testresult_logs_join` WRITE;
/*!40000 ALTER TABLE `testresult_logs_join` DISABLE KEYS */;
/*!40000 ALTER TABLE `testresult_logs_join` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `user_group_map`
--

LOCK TABLES `user_group_map` WRITE;
/*!40000 ALTER TABLE `user_group_map` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_group_map` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` (`user_id`, `bugzilla_uid`, `email`, `password`, `realname`, `irc_nickname`, `enabled`, `authtoken`, `last_updated`, `creation_date`) VALUES (1,NULL,'web-tester@mozilla.org',NULL,'Web Tester','webtest',1,NULL,'2008-03-11 14:10:05','2008-03-11 14:10:05');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

