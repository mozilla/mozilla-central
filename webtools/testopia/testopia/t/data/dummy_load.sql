-- MySQL dump 10.11
--
-- Host: localhost    Database: dummy_load
-- ------------------------------------------------------
-- Server version	5.0.45

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `attach_data`
--

DROP TABLE IF EXISTS `attach_data`;
CREATE TABLE `attach_data` (
  `id` mediumint(9) NOT NULL,
  `thedata` longblob NOT NULL,
  PRIMARY KEY  (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 MAX_ROWS=100000 AVG_ROW_LENGTH=1000000;

--
-- Dumping data for table `attach_data`
--

LOCK TABLES `attach_data` WRITE;
/*!40000 ALTER TABLE `attach_data` DISABLE KEYS */;
INSERT INTO `attach_data` VALUES (1,'Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Nam pellentesque odio et elit. Nam lobortis sem suscipit sapien. Sed iaculis aliquam sapien. Maecenas ut lectus. Aenean fringilla massa et metus. Nam varius, sapien nec egestas feugiat, mi libero dignissim orci, id fermentum quam nisl quis risus. Phasellus libero justo, aliquet quis, pellentesque vitae, porttitor quis, orci. Maecenas sollicitudin. Donec bibendum, ante quis sodales fermentum, quam risus placerat pede, nec aliquam lorem odio sit amet nisi. Ut sem tellus, feugiat vitae, lobortis nec, dapibus at, est. Aenean cursus. Vivamus faucibus lectus eget felis. Nullam commodo tortor vitae turpis.\n\nSed mollis interdum risus. Pellentesque ante velit, facilisis vitae, fermentum eu, feugiat sit amet, dui. Suspendisse tempus ullamcorper nisl. Suspendisse ullamcorper, velit non luctus gravida, massa turpis ullamcorper eros, sed dictum risus neque ut augue. Vestibulum neque nulla, pretium fermentum, rutrum vehicula, pulvinar at, est. Quisque dignissim. Nullam placerat neque vel urna. Quisque cursus lacus rutrum tortor. Nunc ut elit. Vestibulum mi nunc, volutpat id, tempor ut, scelerisque vel, magna. Aenean nisl nulla, rutrum sit amet, sollicitudin sed, molestie eget, nisi. Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. In odio erat, bibendum eu, gravida nec, elementum sed, urna.\n\nAliquam ultricies viverra mi. Ut convallis urna quis urna. Sed sed tortor. Suspendisse quis tellus. Ut gravida. Ut facilisis lectus in purus. Sed at est non libero dignissim varius. Donec vestibulum odio ac felis. Duis interdum pellentesque nisl. Aenean leo. Curabitur lectus. Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Duis nisl ligula, elementum vitae, posuere eu, semper eget, augue. Maecenas metus nulla, ullamcorper id, malesuada sit amet, mattis nec, lacus. Nam tortor.\n\nNam sollicitudin, lacus sit amet aliquam tempus, nulla tellus tempus velit, eu sollicitudin dolor dui et velit. In ac sem. Mauris adipiscing enim in felis. Morbi porttitor laoreet sapien. Nam felis dolor, laoreet sed, iaculis eu, vulputate eu, nunc. Nullam egestas ligula. Fusce ut sapien. Aliquam erat volutpat. Proin tristique scelerisque sem. Nullam non erat.\n\nSed feugiat, lacus in elementum egestas, sapien nulla sodales leo, nec scelerisque diam eros eu arcu. Phasellus ut magna. Cras dignissim pellentesque tellus. Curabitur sapien. Suspendisse a risus lobortis quam consectetuer placerat. Aliquam ultricies pretium tortor. Aliquam erat volutpat. Mauris nunc. Etiam vitae diam. Aenean a felis. Donec posuere, lacus in lacinia commodo, ligula lectus rutrum nibh, non dapibus sapien enim eu mauris. Pellentesque arcu risus, condimentum id, dapibus in, blandit ut, pede. Nulla facilisi. Vestibulum elit quam, fringilla convallis, congue lacinia, dictum at, velit. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia Curae; Sed augue mauris, commodo vel, tincidunt hendrerit, consectetuer eu, eros. \n');
/*!40000 ALTER TABLE `attach_data` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `attachments`
--

DROP TABLE IF EXISTS `attachments`;
CREATE TABLE `attachments` (
  `attach_id` mediumint(9) NOT NULL auto_increment,
  `bug_id` mediumint(9) NOT NULL,
  `creation_ts` datetime NOT NULL,
  `description` mediumtext NOT NULL,
  `mimetype` mediumtext NOT NULL,
  `ispatch` tinyint(4) default NULL,
  `filename` varchar(100) NOT NULL,
  `submitter_id` mediumint(9) NOT NULL,
  `isobsolete` tinyint(4) NOT NULL default '0',
  `isprivate` tinyint(4) NOT NULL default '0',
  `isurl` tinyint(4) NOT NULL default '0',
  PRIMARY KEY  (`attach_id`),
  KEY `attachments_bug_id_idx` (`bug_id`),
  KEY `attachments_creation_ts_idx` (`creation_ts`),
  KEY `attachments_submitter_id_idx` (`submitter_id`,`bug_id`)
) ENGINE=MyISAM AUTO_INCREMENT=2 DEFAULT CHARSET=utf8;

--
-- Dumping data for table `attachments`
--

LOCK TABLES `attachments` WRITE;
/*!40000 ALTER TABLE `attachments` DISABLE KEYS */;
INSERT INTO `attachments` VALUES (1,3,'2008-05-02 15:10:00','LOREM','text/plain',0,'LOREM.TXT',1,0,0,0);
/*!40000 ALTER TABLE `attachments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `bug_group_map`
--

DROP TABLE IF EXISTS `bug_group_map`;
CREATE TABLE `bug_group_map` (
  `bug_id` mediumint(9) NOT NULL,
  `group_id` mediumint(9) NOT NULL,
  UNIQUE KEY `bug_group_map_bug_id_idx` (`bug_id`,`group_id`),
  KEY `bug_group_map_group_id_idx` (`group_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Dumping data for table `bug_group_map`
--

LOCK TABLES `bug_group_map` WRITE;
/*!40000 ALTER TABLE `bug_group_map` DISABLE KEYS */;
INSERT INTO `bug_group_map` VALUES (4,15),(5,16),(6,16);
/*!40000 ALTER TABLE `bug_group_map` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `bug_severity`
--

DROP TABLE IF EXISTS `bug_severity`;
CREATE TABLE `bug_severity` (
  `id` smallint(6) NOT NULL auto_increment,
  `value` varchar(64) NOT NULL,
  `sortkey` smallint(6) NOT NULL default '0',
  `isactive` tinyint(4) NOT NULL default '1',
  PRIMARY KEY  (`id`),
  UNIQUE KEY `bug_severity_value_idx` (`value`),
  KEY `bug_severity_sortkey_idx` (`sortkey`,`value`)
) ENGINE=MyISAM AUTO_INCREMENT=8 DEFAULT CHARSET=utf8;

--
-- Dumping data for table `bug_severity`
--

LOCK TABLES `bug_severity` WRITE;
/*!40000 ALTER TABLE `bug_severity` DISABLE KEYS */;
INSERT INTO `bug_severity` VALUES (1,'blocker',100,1),(2,'critical',200,1),(3,'major',300,1),(4,'normal',400,1),(5,'minor',500,1),(6,'trivial',600,1),(7,'enhancement',700,1);
/*!40000 ALTER TABLE `bug_severity` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `bug_status`
--

DROP TABLE IF EXISTS `bug_status`;
CREATE TABLE `bug_status` (
  `id` smallint(6) NOT NULL auto_increment,
  `value` varchar(64) NOT NULL,
  `sortkey` smallint(6) NOT NULL default '0',
  `isactive` tinyint(4) NOT NULL default '1',
  PRIMARY KEY  (`id`),
  UNIQUE KEY `bug_status_value_idx` (`value`),
  KEY `bug_status_sortkey_idx` (`sortkey`,`value`)
) ENGINE=MyISAM AUTO_INCREMENT=8 DEFAULT CHARSET=utf8;

--
-- Dumping data for table `bug_status`
--

LOCK TABLES `bug_status` WRITE;
/*!40000 ALTER TABLE `bug_status` DISABLE KEYS */;
INSERT INTO `bug_status` VALUES (1,'UNCONFIRMED',100,1),(2,'NEW',200,1),(3,'ASSIGNED',300,1),(4,'REOPENED',400,1),(5,'RESOLVED',500,1),(6,'VERIFIED',600,1),(7,'CLOSED',700,1);
/*!40000 ALTER TABLE `bug_status` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `bugs`
--

DROP TABLE IF EXISTS `bugs`;
CREATE TABLE `bugs` (
  `bug_id` mediumint(9) NOT NULL auto_increment,
  `assigned_to` mediumint(9) NOT NULL,
  `bug_file_loc` text,
  `bug_severity` varchar(64) NOT NULL,
  `bug_status` varchar(64) NOT NULL,
  `creation_ts` datetime default NULL,
  `delta_ts` datetime NOT NULL,
  `short_desc` varchar(255) NOT NULL,
  `op_sys` varchar(64) NOT NULL,
  `priority` varchar(64) NOT NULL,
  `product_id` smallint(6) NOT NULL,
  `rep_platform` varchar(64) NOT NULL,
  `reporter` mediumint(9) NOT NULL,
  `version` varchar(64) NOT NULL,
  `component_id` smallint(6) NOT NULL,
  `resolution` varchar(64) NOT NULL default '',
  `target_milestone` varchar(20) NOT NULL default '---',
  `qa_contact` mediumint(9) default NULL,
  `status_whiteboard` mediumtext NOT NULL,
  `votes` mediumint(9) NOT NULL default '0',
  `keywords` mediumtext NOT NULL,
  `lastdiffed` datetime default NULL,
  `everconfirmed` tinyint(4) NOT NULL,
  `reporter_accessible` tinyint(4) NOT NULL default '1',
  `cclist_accessible` tinyint(4) NOT NULL default '1',
  `estimated_time` decimal(5,2) NOT NULL default '0.00',
  `remaining_time` decimal(5,2) NOT NULL default '0.00',
  `deadline` datetime default NULL,
  `alias` varchar(20) default NULL,
  `infoprovider` int(11) default NULL,
  PRIMARY KEY  (`bug_id`),
  UNIQUE KEY `bugs_alias_idx` (`alias`),
  KEY `bugs_assigned_to_idx` (`assigned_to`),
  KEY `bugs_creation_ts_idx` (`creation_ts`),
  KEY `bugs_delta_ts_idx` (`delta_ts`),
  KEY `bugs_bug_severity_idx` (`bug_severity`),
  KEY `bugs_bug_status_idx` (`bug_status`),
  KEY `bugs_op_sys_idx` (`op_sys`),
  KEY `bugs_priority_idx` (`priority`),
  KEY `bugs_product_id_idx` (`product_id`),
  KEY `bugs_reporter_idx` (`reporter`),
  KEY `bugs_version_idx` (`version`),
  KEY `bugs_component_id_idx` (`component_id`),
  KEY `bugs_resolution_idx` (`resolution`),
  KEY `bugs_target_milestone_idx` (`target_milestone`),
  KEY `bugs_qa_contact_idx` (`qa_contact`),
  KEY `bugs_votes_idx` (`votes`)
) ENGINE=MyISAM AUTO_INCREMENT=7 DEFAULT CHARSET=utf8;

--
-- Dumping data for table `bugs`
--

LOCK TABLES `bugs` WRITE;
/*!40000 ALTER TABLE `bugs` DISABLE KEYS */;
INSERT INTO `bugs` VALUES (1,4,'','normal','NEW','2008-03-27 15:48:39','2008-03-27 15:48:39','PUBLIC VISIBLE BUG','Linux','P5',1,'PC',1,'PUBLIC v1',1,'','PUBLIC M1',5,'',0,'','2008-03-27 15:48:39',1,1,1,'0.00','0.00',NULL,NULL,NULL),(2,4,'','enhancement','NEW','2008-05-01 17:24:10','2008-05-01 17:24:10','[Test Case 5] PUBLIC TEST CASE 3 - CONFIRMED','Linux','P5',1,'PC',1,'PUBLIC v1',1,'','PUBLIC M1',5,'',0,'','2008-05-01 17:24:11',1,1,1,'0.00','0.00',NULL,NULL,NULL),(3,4,'','enhancement','NEW','2008-05-02 15:10:00','2008-05-02 15:10:00','PUBLIC BUG','Linux','P5',1,'PC',1,'PUBLIC v1',1,'','PUBLIC M1',5,'',0,'','2008-05-02 15:10:01',1,1,1,'0.00','0.00',NULL,NULL,NULL),(4,2,'','enhancement','NEW','2008-05-02 15:19:36','2008-05-02 15:19:36','PARTNER VISIBLE BUG','Linux','P5',3,'PC',2,'PARTNER v2',4,'','PARTNER M1',6,'',0,'','2008-05-02 15:19:36',1,1,1,'0.00','0.00',NULL,NULL,NULL),(5,7,'','enhancement','NEW','2008-05-02 15:21:06','2008-05-02 15:21:06','PRIVATE BUG','Linux','P5',2,'PC',7,'PRIVATE v2',3,'','PRIVATE M1',8,'',0,'','2008-05-02 15:21:07',1,1,1,'0.00','0.00',NULL,NULL,NULL),(6,7,'','enhancement','NEW','2008-05-02 15:27:32','2008-05-02 15:27:32','[Test Case 15] PRIVATE CASE (RUN 3)','Linux','P5',2,'PC',3,'PRIVATE v2',3,'','PRIVATE M1',8,'',0,'','2008-05-02 15:27:32',1,1,1,'0.00','0.00',NULL,NULL,NULL);
/*!40000 ALTER TABLE `bugs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `bugs_activity`
--

DROP TABLE IF EXISTS `bugs_activity`;
CREATE TABLE `bugs_activity` (
  `bug_id` mediumint(9) NOT NULL,
  `attach_id` mediumint(9) default NULL,
  `who` mediumint(9) NOT NULL,
  `bug_when` datetime NOT NULL,
  `fieldid` mediumint(9) NOT NULL,
  `added` tinytext,
  `removed` tinytext,
  KEY `bugs_activity_bug_id_idx` (`bug_id`),
  KEY `bugs_activity_who_idx` (`who`),
  KEY `bugs_activity_bug_when_idx` (`bug_when`),
  KEY `bugs_activity_fieldid_idx` (`fieldid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Dumping data for table `bugs_activity`
--

LOCK TABLES `bugs_activity` WRITE;
/*!40000 ALTER TABLE `bugs_activity` DISABLE KEYS */;
/*!40000 ALTER TABLE `bugs_activity` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `bz_schema`
--

DROP TABLE IF EXISTS `bz_schema`;
CREATE TABLE `bz_schema` (
  `schema_data` longblob NOT NULL,
  `version` decimal(3,2) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Dumping data for table `bz_schema`
--

LOCK TABLES `bz_schema` WRITE;
/*!40000 ALTER TABLE `bz_schema` DISABLE KEYS */;
INSERT INTO `bz_schema` VALUES ('$VAR1 = {\n          \'attach_data\' => {\n                             \'FIELDS\' => [\n                                           \'id\',\n                                           {\n                                             \'NOTNULL\' => 1,\n                                             \'PRIMARYKEY\' => 1,\n                                             \'TYPE\' => \'INT3\'\n                                           },\n                                           \'thedata\',\n                                           {\n                                             \'NOTNULL\' => 1,\n                                             \'TYPE\' => \'LONGBLOB\'\n                                           }\n                                         ]\n                           },\n          \'attachments\' => {\n                             \'FIELDS\' => [\n                                           \'attach_id\',\n                                           {\n                                             \'NOTNULL\' => 1,\n                                             \'PRIMARYKEY\' => 1,\n                                             \'TYPE\' => \'MEDIUMSERIAL\'\n                                           },\n                                           \'bug_id\',\n                                           {\n                                             \'NOTNULL\' => 1,\n                                             \'TYPE\' => \'INT3\'\n                                           },\n                                           \'creation_ts\',\n                                           {\n                                             \'NOTNULL\' => 1,\n                                             \'TYPE\' => \'DATETIME\'\n                                           },\n                                           \'description\',\n                                           {\n                                             \'NOTNULL\' => 1,\n                                             \'TYPE\' => \'MEDIUMTEXT\'\n                                           },\n                                           \'mimetype\',\n                                           {\n                                             \'NOTNULL\' => 1,\n                                             \'TYPE\' => \'MEDIUMTEXT\'\n                                           },\n                                           \'ispatch\',\n                                           {\n                                             \'TYPE\' => \'BOOLEAN\'\n                                           },\n                                           \'filename\',\n                                           {\n                                             \'NOTNULL\' => 1,\n                                             \'TYPE\' => \'varchar(100)\'\n                                           },\n                                           \'submitter_id\',\n                                           {\n                                             \'NOTNULL\' => 1,\n                                             \'TYPE\' => \'INT3\'\n                                           },\n                                           \'isobsolete\',\n                                           {\n                                             \'DEFAULT\' => \'FALSE\',\n                                             \'NOTNULL\' => 1,\n                                             \'TYPE\' => \'BOOLEAN\'\n                                           },\n                                           \'isprivate\',\n                                           {\n                                             \'DEFAULT\' => \'FALSE\',\n                                             \'NOTNULL\' => 1,\n                                             \'TYPE\' => \'BOOLEAN\'\n                                           },\n                                           \'isurl\',\n                                           {\n                                             \'DEFAULT\' => \'FALSE\',\n                                             \'NOTNULL\' => 1,\n                                             \'TYPE\' => \'BOOLEAN\'\n                                           }\n                                         ],\n                             \'INDEXES\' => [\n                                            \'attachments_bug_id_idx\',\n                                            [\n                                              \'bug_id\'\n                                            ],\n                                            \'attachments_creation_ts_idx\',\n                                            [\n                                              \'creation_ts\'\n                                            ],\n                                            \'attachments_submitter_id_idx\',\n                                            [\n                                              \'submitter_id\',\n                                              \'bug_id\'\n                                            ]\n                                          ]\n                           },\n          \'bug_group_map\' => {\n                               \'FIELDS\' => [\n                                             \'bug_id\',\n                                             {\n                                               \'NOTNULL\' => 1,\n                                               \'TYPE\' => \'INT3\'\n                                             },\n                                             \'group_id\',\n                                             {\n                                               \'NOTNULL\' => 1,\n                                               \'TYPE\' => \'INT3\'\n                                             }\n                                           ],\n                               \'INDEXES\' => [\n                                              \'bug_group_map_bug_id_idx\',\n                                              {\n                                                \'FIELDS\' => [\n                                                              \'bug_id\',\n                                                              \'group_id\'\n                                                            ],\n                                                \'TYPE\' => \'UNIQUE\'\n                                              },\n                                              \'bug_group_map_group_id_idx\',\n                                              [\n                                                \'group_id\'\n                                              ]\n                                            ]\n                             },\n          \'bug_severity\' => {\n                              \'FIELDS\' => [\n                                            \'id\',\n                                            {\n                                              \'NOTNULL\' => 1,\n                                              \'PRIMARYKEY\' => 1,\n                                              \'TYPE\' => \'SMALLSERIAL\'\n                                            },\n                                            \'value\',\n                                            {\n                                              \'NOTNULL\' => 1,\n                                              \'TYPE\' => \'varchar(64)\'\n                                            },\n                                            \'sortkey\',\n                                            {\n                                              \'DEFAULT\' => 0,\n                                              \'NOTNULL\' => 1,\n                                              \'TYPE\' => \'INT2\'\n                                            },\n                                            \'isactive\',\n                                            {\n                                              \'DEFAULT\' => \'TRUE\',\n                                              \'NOTNULL\' => 1,\n                                              \'TYPE\' => \'BOOLEAN\'\n                                            }\n                                          ],\n                              \'INDEXES\' => [\n                                             \'bug_severity_value_idx\',\n                                             {\n                                               \'FIELDS\' => [\n                                                             \'value\'\n                                                           ],\n                                               \'TYPE\' => \'UNIQUE\'\n                                             },\n                                             \'bug_severity_sortkey_idx\',\n                                             [\n                                               \'sortkey\',\n                                               \'value\'\n                                             ]\n                                           ]\n                            },\n          \'bug_status\' => {\n                            \'FIELDS\' => [\n                                          \'id\',\n                                          {\n                                            \'NOTNULL\' => 1,\n                                            \'PRIMARYKEY\' => 1,\n                                            \'TYPE\' => \'SMALLSERIAL\'\n                                          },\n                                          \'value\',\n                                          {\n                                            \'NOTNULL\' => 1,\n                                            \'TYPE\' => \'varchar(64)\'\n                                          },\n                                          \'sortkey\',\n                                          {\n                                            \'DEFAULT\' => 0,\n                                            \'NOTNULL\' => 1,\n                                            \'TYPE\' => \'INT2\'\n                                          },\n                                          \'isactive\',\n                                          {\n                                            \'DEFAULT\' => \'TRUE\',\n                                            \'NOTNULL\' => 1,\n                                            \'TYPE\' => \'BOOLEAN\'\n                                          }\n                                        ],\n                            \'INDEXES\' => [\n                                           \'bug_status_value_idx\',\n                                           {\n                                             \'FIELDS\' => [\n                                                           \'value\'\n                                                         ],\n                                             \'TYPE\' => \'UNIQUE\'\n                                           },\n                                           \'bug_status_sortkey_idx\',\n                                           [\n                                             \'sortkey\',\n                                             \'value\'\n                                           ]\n                                         ]\n                          },\n          \'bugs\' => {\n                      \'FIELDS\' => [\n                                    \'bug_id\',\n                                    {\n                                      \'NOTNULL\' => 1,\n                                      \'PRIMARYKEY\' => 1,\n                                      \'TYPE\' => \'MEDIUMSERIAL\'\n                                    },\n                                    \'assigned_to\',\n                                    {\n                                      \'NOTNULL\' => 1,\n                                      \'TYPE\' => \'INT3\'\n                                    },\n                                    \'bug_file_loc\',\n                                    {\n                                      \'TYPE\' => \'TEXT\'\n                                    },\n                                    \'bug_severity\',\n                                    {\n                                      \'NOTNULL\' => 1,\n                                      \'TYPE\' => \'varchar(64)\'\n                                    },\n                                    \'bug_status\',\n                                    {\n                                      \'NOTNULL\' => 1,\n                                      \'TYPE\' => \'varchar(64)\'\n                                    },\n                                    \'creation_ts\',\n                                    {\n                                      \'TYPE\' => \'DATETIME\'\n                                    },\n                                    \'delta_ts\',\n                                    {\n                                      \'NOTNULL\' => 1,\n                                      \'TYPE\' => \'DATETIME\'\n                                    },\n                                    \'short_desc\',\n                                    {\n                                      \'NOTNULL\' => 1,\n                                      \'TYPE\' => \'varchar(255)\'\n                                    },\n                                    \'op_sys\',\n                                    {\n                                      \'NOTNULL\' => 1,\n                                      \'TYPE\' => \'varchar(64)\'\n                                    },\n                                    \'priority\',\n                                    {\n                                      \'NOTNULL\' => 1,\n                                      \'TYPE\' => \'varchar(64)\'\n                                    },\n                                    \'product_id\',\n                                    {\n                                      \'NOTNULL\' => 1,\n                                      \'TYPE\' => \'INT2\'\n                                    },\n                                    \'rep_platform\',\n                                    {\n                                      \'NOTNULL\' => 1,\n                                      \'TYPE\' => \'varchar(64)\'\n                                    },\n                                    \'reporter\',\n                                    {\n                                      \'NOTNULL\' => 1,\n                                      \'TYPE\' => \'INT3\'\n                                    },\n                                    \'version\',\n                                    {\n                                      \'NOTNULL\' => 1,\n                                      \'TYPE\' => \'varchar(64)\'\n                                    },\n                                    \'component_id\',\n                                    {\n                                      \'NOTNULL\' => 1,\n                                      \'TYPE\' => \'INT2\'\n                                    },\n                                    \'resolution\',\n                                    {\n                                      \'DEFAULT\' => \'\\\'\\\'\',\n                                      \'NOTNULL\' => 1,\n                                      \'TYPE\' => \'varchar(64)\'\n                                    },\n                                    \'target_milestone\',\n                                    {\n                                      \'DEFAULT\' => \'\\\'---\\\'\',\n                                      \'NOTNULL\' => 1,\n                                      \'TYPE\' => \'varchar(20)\'\n                                    },\n                                    \'qa_contact\',\n                                    {\n                                      \'TYPE\' => \'INT3\'\n                                    },\n                                    \'status_whiteboard\',\n                                    {\n                                      \'DEFAULT\' => \'\\\'\\\'\',\n                                      \'NOTNULL\' => 1,\n                                      \'TYPE\' => \'MEDIUMTEXT\'\n                                    },\n                                    \'votes\',\n                                    {\n                                      \'DEFAULT\' => \'0\',\n                                      \'NOTNULL\' => 1,\n                                      \'TYPE\' => \'INT3\'\n                                    },\n                                    \'keywords\',\n                                    {\n                                      \'DEFAULT\' => \'\\\'\\\'\',\n                                      \'NOTNULL\' => 1,\n                                      \'TYPE\' => \'MEDIUMTEXT\'\n                                    },\n                                    \'lastdiffed\',\n                                    {\n                                      \'TYPE\' => \'DATETIME\'\n                                    },\n                                    \'everconfirmed\',\n                                    {\n                                      \'NOTNULL\' => 1,\n                                      \'TYPE\' => \'BOOLEAN\'\n                                    },\n                                    \'reporter_accessible\',\n                                    {\n                                      \'DEFAULT\' => \'TRUE\',\n                                      \'NOTNULL\' => 1,\n                                      \'TYPE\' => \'BOOLEAN\'\n                                    },\n                                    \'cclist_accessible\',\n                                    {\n                                      \'DEFAULT\' => \'TRUE\',\n                                      \'NOTNULL\' => 1,\n                                      \'TYPE\' => \'BOOLEAN\'\n                                    },\n                                    \'estimated_time\',\n                                    {\n                                      \'DEFAULT\' => \'0\',\n                                      \'NOTNULL\' => 1,\n                                      \'TYPE\' => \'decimal(5,2)\'\n                                    },\n                                    \'remaining_time\',\n                                    {\n                                      \'DEFAULT\' => \'0\',\n                                      \'NOTNULL\' => 1,\n                                      \'TYPE\' => \'decimal(5,2)\'\n                                    },\n                                    \'deadline\',\n                                    {\n                                      \'TYPE\' => \'DATETIME\'\n                                    },\n                                    \'alias\',\n                                    {\n                                      \'TYPE\' => \'varchar(20)\'\n                                    }\n                                  ],\n                      \'INDEXES\' => [\n                                     \'bugs_alias_idx\',\n                                     {\n                                       \'FIELDS\' => [\n                                                     \'alias\'\n                                                   ],\n                                       \'TYPE\' => \'UNIQUE\'\n                                     },\n                                     \'bugs_assigned_to_idx\',\n                                     [\n                                       \'assigned_to\'\n                                     ],\n                                     \'bugs_creation_ts_idx\',\n                                     [\n                                       \'creation_ts\'\n                                     ],\n                                     \'bugs_delta_ts_idx\',\n                                     [\n                                       \'delta_ts\'\n                                     ],\n                                     \'bugs_bug_severity_idx\',\n                                     [\n                                       \'bug_severity\'\n                                     ],\n                                     \'bugs_bug_status_idx\',\n                                     [\n                                       \'bug_status\'\n                                     ],\n                                     \'bugs_op_sys_idx\',\n                                     [\n                                       \'op_sys\'\n                                     ],\n                                     \'bugs_priority_idx\',\n                                     [\n                                       \'priority\'\n                                     ],\n                                     \'bugs_product_id_idx\',\n                                     [\n                                       \'product_id\'\n                                     ],\n                                     \'bugs_reporter_idx\',\n                                     [\n                                       \'reporter\'\n                                     ],\n                                     \'bugs_version_idx\',\n                                     [\n                                       \'version\'\n                                     ],\n                                     \'bugs_component_id_idx\',\n                                     [\n                                       \'component_id\'\n                                     ],\n                                     \'bugs_resolution_idx\',\n                                     [\n                                       \'resolution\'\n                                     ],\n                                     \'bugs_target_milestone_idx\',\n                                     [\n                                       \'target_milestone\'\n                                     ],\n                                     \'bugs_qa_contact_idx\',\n                                     [\n                                       \'qa_contact\'\n                                     ],\n                                     \'bugs_votes_idx\',\n                                     [\n                                       \'votes\'\n                                     ]\n                                   ]\n                    },\n          \'bugs_activity\' => {\n                               \'FIELDS\' => [\n                                             \'bug_id\',\n                                             {\n                                               \'NOTNULL\' => 1,\n                                               \'TYPE\' => \'INT3\'\n                                             },\n                                             \'attach_id\',\n                                             {\n                                               \'TYPE\' => \'INT3\'\n                                             },\n                                             \'who\',\n                                             {\n                                               \'NOTNULL\' => 1,\n                                               \'TYPE\' => \'INT3\'\n                                             },\n                                             \'bug_when\',\n                                             {\n                                               \'NOTNULL\' => 1,\n                                               \'TYPE\' => \'DATETIME\'\n                                             },\n                                             \'fieldid\',\n                                             {\n                                               \'NOTNULL\' => 1,\n                                               \'TYPE\' => \'INT3\'\n                                             },\n                                             \'added\',\n                                             {\n                                               \'TYPE\' => \'TINYTEXT\'\n                                             },\n                                             \'removed\',\n                                             {\n                                               \'TYPE\' => \'TINYTEXT\'\n                                             }\n                                           ],\n                               \'INDEXES\' => [\n                                              \'bugs_activity_bug_id_idx\',\n                                              [\n                                                \'bug_id\'\n                                              ],\n                                              \'bugs_activity_who_idx\',\n                                              [\n                                                \'who\'\n                                              ],\n                                              \'bugs_activity_bug_when_idx\',\n                                              [\n                                                \'bug_when\'\n                                              ],\n                                              \'bugs_activity_fieldid_idx\',\n                                              [\n                                                \'fieldid\'\n                                              ]\n                                            ]\n                             },\n          \'bz_schema\' => {\n                           \'FIELDS\' => [\n                                         \'schema_data\',\n                                         {\n                                           \'NOTNULL\' => 1,\n                                           \'TYPE\' => \'LONGBLOB\'\n                                         },\n                                         \'version\',\n                                         {\n                                           \'NOTNULL\' => 1,\n                                           \'TYPE\' => \'decimal(3,2)\'\n                                         }\n                                       ]\n                         },\n          \'category_group_map\' => {\n                                    \'FIELDS\' => [\n                                                  \'category_id\',\n                                                  {\n                                                    \'NOTNULL\' => 1,\n                                                    \'TYPE\' => \'INT2\'\n                                                  },\n                                                  \'group_id\',\n                                                  {\n                                                    \'NOTNULL\' => 1,\n                                                    \'TYPE\' => \'INT3\'\n                                                  }\n                                                ],\n                                    \'INDEXES\' => [\n                                                   \'category_group_map_category_id_idx\',\n                                                   {\n                                                     \'FIELDS\' => [\n                                                                   \'category_id\',\n                                                                   \'group_id\'\n                                                                 ],\n                                                     \'TYPE\' => \'UNIQUE\'\n                                                   }\n                                                 ]\n                                  },\n          \'cc\' => {\n                    \'FIELDS\' => [\n                                  \'bug_id\',\n                                  {\n                                    \'NOTNULL\' => 1,\n                                    \'TYPE\' => \'INT3\'\n                                  },\n                                  \'who\',\n                                  {\n                                    \'NOTNULL\' => 1,\n                                    \'TYPE\' => \'INT3\'\n                                  }\n                                ],\n                    \'INDEXES\' => [\n                                   \'cc_bug_id_idx\',\n                                   {\n                                     \'FIELDS\' => [\n                                                   \'bug_id\',\n                                                   \'who\'\n                                                 ],\n                                     \'TYPE\' => \'UNIQUE\'\n                                   },\n                                   \'cc_who_idx\',\n                                   [\n                                     \'who\'\n                                   ]\n                                 ]\n                  },\n          \'classifications\' => {\n                                 \'FIELDS\' => [\n                                               \'id\',\n                                               {\n                                                 \'NOTNULL\' => 1,\n                                                 \'PRIMARYKEY\' => 1,\n                                                 \'TYPE\' => \'SMALLSERIAL\'\n                                               },\n                                               \'name\',\n                                               {\n                                                 \'NOTNULL\' => 1,\n                                                 \'TYPE\' => \'varchar(64)\'\n                                               },\n                                               \'description\',\n                                               {\n                                                 \'TYPE\' => \'MEDIUMTEXT\'\n                                               },\n                                               \'sortkey\',\n                                               {\n                                                 \'DEFAULT\' => \'0\',\n                                                 \'NOTNULL\' => 1,\n                                                 \'TYPE\' => \'INT2\'\n                                               }\n                                             ],\n                                 \'INDEXES\' => [\n                                                \'classifications_name_idx\',\n                                                {\n                                                  \'FIELDS\' => [\n                                                                \'name\'\n                                                              ],\n                                                  \'TYPE\' => \'UNIQUE\'\n                                                }\n                                              ]\n                               },\n          \'component_cc\' => {\n                              \'FIELDS\' => [\n                                            \'user_id\',\n                                            {\n                                              \'NOTNULL\' => 1,\n                                              \'TYPE\' => \'INT3\'\n                                            },\n                                            \'component_id\',\n                                            {\n                                              \'NOTNULL\' => 1,\n                                              \'TYPE\' => \'INT2\'\n                                            }\n                                          ],\n                              \'INDEXES\' => [\n                                             \'component_cc_user_id_idx\',\n                                             {\n                                               \'FIELDS\' => [\n                                                             \'component_id\',\n                                                             \'user_id\'\n                                                           ],\n                                               \'TYPE\' => \'UNIQUE\'\n                                             }\n                                           ]\n                            },\n          \'components\' => {\n                            \'FIELDS\' => [\n                                          \'id\',\n                                          {\n                                            \'NOTNULL\' => 1,\n                                            \'PRIMARYKEY\' => 1,\n                                            \'TYPE\' => \'SMALLSERIAL\'\n                                          },\n                                          \'name\',\n                                          {\n                                            \'NOTNULL\' => 1,\n                                            \'TYPE\' => \'varchar(64)\'\n                                          },\n                                          \'product_id\',\n                                          {\n                                            \'NOTNULL\' => 1,\n                                            \'TYPE\' => \'INT2\'\n                                          },\n                                          \'initialowner\',\n                                          {\n                                            \'NOTNULL\' => 1,\n                                            \'TYPE\' => \'INT3\'\n                                          },\n                                          \'initialqacontact\',\n                                          {\n                                            \'TYPE\' => \'INT3\'\n                                          },\n                                          \'description\',\n                                          {\n                                            \'NOTNULL\' => 1,\n                                            \'TYPE\' => \'MEDIUMTEXT\'\n                                          }\n                                        ],\n                            \'INDEXES\' => [\n                                           \'components_product_id_idx\',\n                                           {\n                                             \'FIELDS\' => [\n                                                           \'product_id\',\n                                                           \'name\'\n                                                         ],\n                                             \'TYPE\' => \'UNIQUE\'\n                                           },\n                                           \'components_name_idx\',\n                                           [\n                                             \'name\'\n                                           ]\n                                         ]\n                          },\n          \'dependencies\' => {\n                              \'FIELDS\' => [\n                                            \'blocked\',\n                                            {\n                                              \'NOTNULL\' => 1,\n                                              \'TYPE\' => \'INT3\'\n                                            },\n                                            \'dependson\',\n                                            {\n                                              \'NOTNULL\' => 1,\n                                              \'TYPE\' => \'INT3\'\n                                            }\n                                          ],\n                              \'INDEXES\' => [\n                                             \'dependencies_blocked_idx\',\n                                             [\n                                               \'blocked\'\n                                             ],\n                                             \'dependencies_dependson_idx\',\n                                             [\n                                               \'dependson\'\n                                             ]\n                                           ]\n                            },\n          \'duplicates\' => {\n                            \'FIELDS\' => [\n                                          \'dupe_of\',\n                                          {\n                                            \'NOTNULL\' => 1,\n                                            \'TYPE\' => \'INT3\'\n                                          },\n                                          \'dupe\',\n                                          {\n                                            \'NOTNULL\' => 1,\n                                            \'PRIMARYKEY\' => 1,\n                                            \'TYPE\' => \'INT3\'\n                                          }\n                                        ]\n                          },\n          \'email_setting\' => {\n                               \'FIELDS\' => [\n                                             \'user_id\',\n                                             {\n                                               \'NOTNULL\' => 1,\n                                               \'TYPE\' => \'INT3\'\n                                             },\n                                             \'relationship\',\n                                             {\n                                               \'NOTNULL\' => 1,\n                                               \'TYPE\' => \'INT1\'\n                                             },\n                                             \'event\',\n                                             {\n                                               \'NOTNULL\' => 1,\n                                               \'TYPE\' => \'INT1\'\n                                             }\n                                           ],\n                               \'INDEXES\' => [\n                                              \'email_setting_user_id_idx\',\n                                              {\n                                                \'FIELDS\' => [\n                                                              \'user_id\',\n                                                              \'relationship\',\n                                                              \'event\'\n                                                            ],\n                                                \'TYPE\' => \'UNIQUE\'\n                                              }\n                                            ]\n                             },\n          \'fielddefs\' => {\n                           \'FIELDS\' => [\n                                         \'id\',\n                                         {\n                                           \'NOTNULL\' => 1,\n                                           \'PRIMARYKEY\' => 1,\n                                           \'TYPE\' => \'MEDIUMSERIAL\'\n                                         },\n                                         \'name\',\n                                         {\n                                           \'NOTNULL\' => 1,\n                                           \'TYPE\' => \'varchar(64)\'\n                                         },\n                                         \'type\',\n                                         {\n                                           \'DEFAULT\' => 0,\n                                           \'NOTNULL\' => 1,\n                                           \'TYPE\' => \'INT2\'\n                                         },\n                                         \'custom\',\n                                         {\n                                           \'DEFAULT\' => \'FALSE\',\n                                           \'NOTNULL\' => 1,\n                                           \'TYPE\' => \'BOOLEAN\'\n                                         },\n                                         \'description\',\n                                         {\n                                           \'NOTNULL\' => 1,\n                                           \'TYPE\' => \'MEDIUMTEXT\'\n                                         },\n                                         \'mailhead\',\n                                         {\n                                           \'DEFAULT\' => \'FALSE\',\n                                           \'NOTNULL\' => 1,\n                                           \'TYPE\' => \'BOOLEAN\'\n                                         },\n                                         \'sortkey\',\n                                         {\n                                           \'NOTNULL\' => 1,\n                                           \'TYPE\' => \'INT2\'\n                                         },\n                                         \'obsolete\',\n                                         {\n                                           \'DEFAULT\' => \'FALSE\',\n                                           \'NOTNULL\' => 1,\n                                           \'TYPE\' => \'BOOLEAN\'\n                                         },\n                                         \'enter_bug\',\n                                         {\n                                           \'DEFAULT\' => \'FALSE\',\n                                           \'NOTNULL\' => 1,\n                                           \'TYPE\' => \'BOOLEAN\'\n                                         }\n                                       ],\n                           \'INDEXES\' => [\n                                          \'fielddefs_name_idx\',\n                                          {\n                                            \'FIELDS\' => [\n                                                          \'name\'\n                                                        ],\n                                            \'TYPE\' => \'UNIQUE\'\n                                          },\n                                          \'fielddefs_sortkey_idx\',\n                                          [\n                                            \'sortkey\'\n                                          ]\n                                        ]\n                         },\n          \'flagexclusions\' => {\n                                \'FIELDS\' => [\n                                              \'type_id\',\n                                              {\n                                                \'NOTNULL\' => 1,\n                                                \'TYPE\' => \'INT2\'\n                                              },\n                                              \'product_id\',\n                                              {\n                                                \'TYPE\' => \'INT2\'\n                                              },\n                                              \'component_id\',\n                                              {\n                                                \'TYPE\' => \'INT2\'\n                                              }\n                                            ],\n                                \'INDEXES\' => [\n                                               \'flagexclusions_type_id_idx\',\n                                               [\n                                                 \'type_id\',\n                                                 \'product_id\',\n                                                 \'component_id\'\n                                               ]\n                                             ]\n                              },\n          \'flaginclusions\' => {\n                                \'FIELDS\' => [\n                                              \'type_id\',\n                                              {\n                                                \'NOTNULL\' => 1,\n                                                \'TYPE\' => \'INT2\'\n                                              },\n                                              \'product_id\',\n                                              {\n                                                \'TYPE\' => \'INT2\'\n                                              },\n                                              \'component_id\',\n                                              {\n                                                \'TYPE\' => \'INT2\'\n                                              }\n                                            ],\n                                \'INDEXES\' => [\n                                               \'flaginclusions_type_id_idx\',\n                                               [\n                                                 \'type_id\',\n                                                 \'product_id\',\n                                                 \'component_id\'\n                                               ]\n                                             ]\n                              },\n          \'flags\' => {\n                       \'FIELDS\' => [\n                                     \'id\',\n                                     {\n                                       \'NOTNULL\' => 1,\n                                       \'PRIMARYKEY\' => 1,\n                                       \'TYPE\' => \'MEDIUMSERIAL\'\n                                     },\n                                     \'type_id\',\n                                     {\n                                       \'NOTNULL\' => 1,\n                                       \'TYPE\' => \'INT2\'\n                                     },\n                                     \'status\',\n                                     {\n                                       \'NOTNULL\' => 1,\n                                       \'TYPE\' => \'char(1)\'\n                                     },\n                                     \'bug_id\',\n                                     {\n                                       \'NOTNULL\' => 1,\n                                       \'TYPE\' => \'INT3\'\n                                     },\n                                     \'attach_id\',\n                                     {\n                                       \'TYPE\' => \'INT3\'\n                                     },\n                                     \'creation_date\',\n                                     {\n                                       \'NOTNULL\' => 1,\n                                       \'TYPE\' => \'DATETIME\'\n                                     },\n                                     \'modification_date\',\n                                     {\n                                       \'TYPE\' => \'DATETIME\'\n                                     },\n                                     \'setter_id\',\n                                     {\n                                       \'TYPE\' => \'INT3\'\n                                     },\n                                     \'requestee_id\',\n                                     {\n                                       \'TYPE\' => \'INT3\'\n                                     }\n                                   ],\n                       \'INDEXES\' => [\n                                      \'flags_bug_id_idx\',\n                                      [\n                                        \'bug_id\',\n                                        \'attach_id\'\n                                      ],\n                                      \'flags_setter_id_idx\',\n                                      [\n                                        \'setter_id\'\n                                      ],\n                                      \'flags_requestee_id_idx\',\n                                      [\n                                        \'requestee_id\'\n                                      ],\n                                      \'flags_type_id_idx\',\n                                      [\n                                        \'type_id\'\n                                      ]\n                                    ]\n                     },\n          \'flagtypes\' => {\n                           \'FIELDS\' => [\n                                         \'id\',\n                                         {\n                                           \'NOTNULL\' => 1,\n                                           \'PRIMARYKEY\' => 1,\n                                           \'TYPE\' => \'SMALLSERIAL\'\n                                         },\n                                         \'name\',\n                                         {\n                                           \'NOTNULL\' => 1,\n                                           \'TYPE\' => \'varchar(50)\'\n                                         },\n                                         \'description\',\n                                         {\n                                           \'TYPE\' => \'TEXT\'\n                                         },\n                                         \'cc_list\',\n                                         {\n                                           \'TYPE\' => \'varchar(200)\'\n                                         },\n                                         \'target_type\',\n                                         {\n                                           \'DEFAULT\' => \'\\\'b\\\'\',\n                                           \'NOTNULL\' => 1,\n                                           \'TYPE\' => \'char(1)\'\n                                         },\n                                         \'is_active\',\n                                         {\n                                           \'DEFAULT\' => \'TRUE\',\n                                           \'NOTNULL\' => 1,\n                                           \'TYPE\' => \'BOOLEAN\'\n                                         },\n                                         \'is_requestable\',\n                                         {\n                                           \'DEFAULT\' => \'FALSE\',\n                                           \'NOTNULL\' => 1,\n                                           \'TYPE\' => \'BOOLEAN\'\n                                         },\n                                         \'is_requesteeble\',\n                                         {\n                                           \'DEFAULT\' => \'FALSE\',\n                                           \'NOTNULL\' => 1,\n                                           \'TYPE\' => \'BOOLEAN\'\n                                         },\n                                         \'is_multiplicable\',\n                                         {\n                                           \'DEFAULT\' => \'FALSE\',\n                                           \'NOTNULL\' => 1,\n                                           \'TYPE\' => \'BOOLEAN\'\n                                         },\n                                         \'sortkey\',\n                                         {\n                                           \'DEFAULT\' => \'0\',\n                                           \'NOTNULL\' => 1,\n                                           \'TYPE\' => \'INT2\'\n                                         },\n                                         \'grant_group_id\',\n                                         {\n                                           \'TYPE\' => \'INT3\'\n                                         },\n                                         \'request_group_id\',\n                                         {\n                                           \'TYPE\' => \'INT3\'\n                                         }\n                                       ]\n                         },\n          \'group_control_map\' => {\n                                   \'FIELDS\' => [\n                                                 \'group_id\',\n                                                 {\n                                                   \'NOTNULL\' => 1,\n                                                   \'TYPE\' => \'INT3\'\n                                                 },\n                                                 \'product_id\',\n                                                 {\n                                                   \'NOTNULL\' => 1,\n                                                   \'TYPE\' => \'INT3\'\n                                                 },\n                                                 \'entry\',\n                                                 {\n                                                   \'NOTNULL\' => 1,\n                                                   \'TYPE\' => \'BOOLEAN\'\n                                                 },\n                                                 \'membercontrol\',\n                                                 {\n                                                   \'NOTNULL\' => 1,\n                                                   \'TYPE\' => \'BOOLEAN\'\n                                                 },\n                                                 \'othercontrol\',\n                                                 {\n                                                   \'NOTNULL\' => 1,\n                                                   \'TYPE\' => \'BOOLEAN\'\n                                                 },\n                                                 \'canedit\',\n                                                 {\n                                                   \'NOTNULL\' => 1,\n                                                   \'TYPE\' => \'BOOLEAN\'\n                                                 },\n                                                 \'editcomponents\',\n                                                 {\n                                                   \'DEFAULT\' => \'FALSE\',\n                                                   \'NOTNULL\' => 1,\n                                                   \'TYPE\' => \'BOOLEAN\'\n                                                 },\n                                                 \'editbugs\',\n                                                 {\n                                                   \'DEFAULT\' => \'FALSE\',\n                                                   \'NOTNULL\' => 1,\n                                                   \'TYPE\' => \'BOOLEAN\'\n                                                 },\n                                                 \'canconfirm\',\n                                                 {\n                                                   \'DEFAULT\' => \'FALSE\',\n                                                   \'NOTNULL\' => 1,\n                                                   \'TYPE\' => \'BOOLEAN\'\n                                                 }\n                                               ],\n                                   \'INDEXES\' => [\n                                                  \'group_control_map_product_id_idx\',\n                                                  {\n                                                    \'FIELDS\' => [\n                                                                  \'product_id\',\n                                                                  \'group_id\'\n                                                                ],\n                                                    \'TYPE\' => \'UNIQUE\'\n                                                  },\n                                                  \'group_control_map_group_id_idx\',\n                                                  [\n                                                    \'group_id\'\n                                                  ]\n                                                ]\n                                 },\n          \'group_group_map\' => {\n                                 \'FIELDS\' => [\n                                               \'member_id\',\n                                               {\n                                                 \'NOTNULL\' => 1,\n                                                 \'TYPE\' => \'INT3\'\n                                               },\n                                               \'grantor_id\',\n                                               {\n                                                 \'NOTNULL\' => 1,\n                                                 \'TYPE\' => \'INT3\'\n                                               },\n                                               \'grant_type\',\n                                               {\n                                                 \'DEFAULT\' => \'0\',\n                                                 \'NOTNULL\' => 1,\n                                                 \'TYPE\' => \'INT1\'\n                                               }\n                                             ],\n                                 \'INDEXES\' => [\n                                                \'group_group_map_member_id_idx\',\n                                                {\n                                                  \'FIELDS\' => [\n                                                                \'member_id\',\n                                                                \'grantor_id\',\n                                                                \'grant_type\'\n                                                              ],\n                                                  \'TYPE\' => \'UNIQUE\'\n                                                }\n                                              ]\n                               },\n          \'groups\' => {\n                        \'FIELDS\' => [\n                                      \'id\',\n                                      {\n                                        \'NOTNULL\' => 1,\n                                        \'PRIMARYKEY\' => 1,\n                                        \'TYPE\' => \'MEDIUMSERIAL\'\n                                      },\n                                      \'name\',\n                                      {\n                                        \'NOTNULL\' => 1,\n                                        \'TYPE\' => \'varchar(255)\'\n                                      },\n                                      \'description\',\n                                      {\n                                        \'NOTNULL\' => 1,\n                                        \'TYPE\' => \'TEXT\'\n                                      },\n                                      \'isbuggroup\',\n                                      {\n                                        \'NOTNULL\' => 1,\n                                        \'TYPE\' => \'BOOLEAN\'\n                                      },\n                                      \'userregexp\',\n                                      {\n                                        \'DEFAULT\' => \'\\\'\\\'\',\n                                        \'NOTNULL\' => 1,\n                                        \'TYPE\' => \'TINYTEXT\'\n                                      },\n                                      \'isactive\',\n                                      {\n                                        \'DEFAULT\' => \'TRUE\',\n                                        \'NOTNULL\' => 1,\n                                        \'TYPE\' => \'BOOLEAN\'\n                                      }\n                                    ],\n                        \'INDEXES\' => [\n                                       \'groups_name_idx\',\n                                       {\n                                         \'FIELDS\' => [\n                                                       \'name\'\n                                                     ],\n                                         \'TYPE\' => \'UNIQUE\'\n                                       }\n                                     ]\n                      },\n          \'keyworddefs\' => {\n                             \'FIELDS\' => [\n                                           \'id\',\n                                           {\n                                             \'NOTNULL\' => 1,\n                                             \'PRIMARYKEY\' => 1,\n                                             \'TYPE\' => \'SMALLSERIAL\'\n                                           },\n                                           \'name\',\n                                           {\n                                             \'NOTNULL\' => 1,\n                                             \'TYPE\' => \'varchar(64)\'\n                                           },\n                                           \'description\',\n                                           {\n                                             \'TYPE\' => \'MEDIUMTEXT\'\n                                           }\n                                         ],\n                             \'INDEXES\' => [\n                                            \'keyworddefs_name_idx\',\n                                            {\n                                              \'FIELDS\' => [\n                                                            \'name\'\n                                                          ],\n                                              \'TYPE\' => \'UNIQUE\'\n                                            }\n                                          ]\n                           },\n          \'keywords\' => {\n                          \'FIELDS\' => [\n                                        \'bug_id\',\n                                        {\n                                          \'NOTNULL\' => 1,\n                                          \'TYPE\' => \'INT3\'\n                                        },\n                                        \'keywordid\',\n                                        {\n                                          \'NOTNULL\' => 1,\n                                          \'TYPE\' => \'INT2\'\n                                        }\n                                      ],\n                          \'INDEXES\' => [\n                                         \'keywords_bug_id_idx\',\n                                         {\n                                           \'FIELDS\' => [\n                                                         \'bug_id\',\n                                                         \'keywordid\'\n                                                       ],\n                                           \'TYPE\' => \'UNIQUE\'\n                                         },\n                                         \'keywords_keywordid_idx\',\n                                         [\n                                           \'keywordid\'\n                                         ]\n                                       ]\n                        },\n          \'logincookies\' => {\n                              \'FIELDS\' => [\n                                            \'cookie\',\n                                            {\n                                              \'NOTNULL\' => 1,\n                                              \'PRIMARYKEY\' => 1,\n                                              \'TYPE\' => \'varchar(16)\'\n                                            },\n                                            \'userid\',\n                                            {\n                                              \'NOTNULL\' => 1,\n                                              \'TYPE\' => \'INT3\'\n                                            },\n                                            \'ipaddr\',\n                                            {\n                                              \'NOTNULL\' => 1,\n                                              \'TYPE\' => \'varchar(40)\'\n                                            },\n                                            \'lastused\',\n                                            {\n                                              \'NOTNULL\' => 1,\n                                              \'TYPE\' => \'DATETIME\'\n                                            }\n                                          ],\n                              \'INDEXES\' => [\n                                             \'logincookies_lastused_idx\',\n                                             [\n                                               \'lastused\'\n                                             ]\n                                           ]\n                            },\n          \'longdescs\' => {\n                           \'FIELDS\' => [\n                                         \'comment_id\',\n                                         {\n                                           \'NOTNULL\' => 1,\n                                           \'PRIMARYKEY\' => 1,\n                                           \'TYPE\' => \'MEDIUMSERIAL\'\n                                         },\n                                         \'bug_id\',\n                                         {\n                                           \'NOTNULL\' => 1,\n                                           \'TYPE\' => \'INT3\'\n                                         },\n                                         \'who\',\n                                         {\n                                           \'NOTNULL\' => 1,\n                                           \'TYPE\' => \'INT3\'\n                                         },\n                                         \'bug_when\',\n                                         {\n                                           \'NOTNULL\' => 1,\n                                           \'TYPE\' => \'DATETIME\'\n                                         },\n                                         \'work_time\',\n                                         {\n                                           \'DEFAULT\' => \'0\',\n                                           \'NOTNULL\' => 1,\n                                           \'TYPE\' => \'decimal(5,2)\'\n                                         },\n                                         \'thetext\',\n                                         {\n                                           \'NOTNULL\' => 1,\n                                           \'TYPE\' => \'MEDIUMTEXT\'\n                                         },\n                                         \'isprivate\',\n                                         {\n                                           \'DEFAULT\' => \'FALSE\',\n                                           \'NOTNULL\' => 1,\n                                           \'TYPE\' => \'BOOLEAN\'\n                                         },\n                                         \'already_wrapped\',\n                                         {\n                                           \'DEFAULT\' => \'FALSE\',\n                                           \'NOTNULL\' => 1,\n                                           \'TYPE\' => \'BOOLEAN\'\n                                         },\n                                         \'type\',\n                                         {\n                                           \'DEFAULT\' => \'0\',\n                                           \'NOTNULL\' => 1,\n                                           \'TYPE\' => \'INT2\'\n                                         },\n                                         \'extra_data\',\n                                         {\n                                           \'TYPE\' => \'varchar(255)\'\n                                         }\n                                       ],\n                           \'INDEXES\' => [\n                                          \'longdescs_bug_id_idx\',\n                                          [\n                                            \'bug_id\'\n                                          ],\n                                          \'longdescs_who_idx\',\n                                          [\n                                            \'who\',\n                                            \'bug_id\'\n                                          ],\n                                          \'longdescs_bug_when_idx\',\n                                          [\n                                            \'bug_when\'\n                                          ],\n                                          \'longdescs_thetext_idx\',\n                                          {\n                                            \'FIELDS\' => [\n                                                          \'thetext\'\n                                                        ],\n                                            \'TYPE\' => \'FULLTEXT\'\n                                          }\n                                        ]\n                         },\n          \'milestones\' => {\n                            \'FIELDS\' => [\n                                          \'id\',\n                                          {\n                                            \'NOTNULL\' => 1,\n                                            \'PRIMARYKEY\' => 1,\n                                            \'TYPE\' => \'MEDIUMSERIAL\'\n                                          },\n                                          \'product_id\',\n                                          {\n                                            \'NOTNULL\' => 1,\n                                            \'TYPE\' => \'INT2\'\n                                          },\n                                          \'value\',\n                                          {\n                                            \'NOTNULL\' => 1,\n                                            \'TYPE\' => \'varchar(20)\'\n                                          },\n                                          \'sortkey\',\n                                          {\n                                            \'DEFAULT\' => 0,\n                                            \'NOTNULL\' => 1,\n                                            \'TYPE\' => \'INT2\'\n                                          }\n                                        ],\n                            \'INDEXES\' => [\n                                           \'milestones_product_id_idx\',\n                                           {\n                                             \'FIELDS\' => [\n                                                           \'product_id\',\n                                                           \'value\'\n                                                         ],\n                                             \'TYPE\' => \'UNIQUE\'\n                                           }\n                                         ]\n                          },\n          \'namedqueries\' => {\n                              \'FIELDS\' => [\n                                            \'id\',\n                                            {\n                                              \'NOTNULL\' => 1,\n                                              \'PRIMARYKEY\' => 1,\n                                              \'TYPE\' => \'MEDIUMSERIAL\'\n                                            },\n                                            \'userid\',\n                                            {\n                                              \'NOTNULL\' => 1,\n                                              \'TYPE\' => \'INT3\'\n                                            },\n                                            \'name\',\n                                            {\n                                              \'NOTNULL\' => 1,\n                                              \'TYPE\' => \'varchar(64)\'\n                                            },\n                                            \'query\',\n                                            {\n                                              \'NOTNULL\' => 1,\n                                              \'TYPE\' => \'MEDIUMTEXT\'\n                                            },\n                                            \'query_type\',\n                                            {\n                                              \'NOTNULL\' => 1,\n                                              \'TYPE\' => \'BOOLEAN\'\n                                            }\n                                          ],\n                              \'INDEXES\' => [\n                                             \'namedqueries_userid_idx\',\n                                             {\n                                               \'FIELDS\' => [\n                                                             \'userid\',\n                                                             \'name\'\n                                                           ],\n                                               \'TYPE\' => \'UNIQUE\'\n                                             }\n                                           ]\n                            },\n          \'namedqueries_link_in_footer\' => {\n                                             \'FIELDS\' => [\n                                                           \'namedquery_id\',\n                                                           {\n                                                             \'NOTNULL\' => 1,\n                                                             \'TYPE\' => \'INT3\'\n                                                           },\n                                                           \'user_id\',\n                                                           {\n                                                             \'NOTNULL\' => 1,\n                                                             \'TYPE\' => \'INT3\'\n                                                           }\n                                                         ],\n                                             \'INDEXES\' => [\n                                                            \'namedqueries_link_in_footer_id_idx\',\n                                                            {\n                                                              \'FIELDS\' => [\n                                                                            \'namedquery_id\',\n                                                                            \'user_id\'\n                                                                          ],\n                                                              \'TYPE\' => \'UNIQUE\'\n                                                            },\n                                                            \'namedqueries_link_in_footer_userid_idx\',\n                                                            [\n                                                              \'user_id\'\n                                                            ]\n                                                          ]\n                                           },\n          \'namedquery_group_map\' => {\n                                      \'FIELDS\' => [\n                                                    \'namedquery_id\',\n                                                    {\n                                                      \'NOTNULL\' => 1,\n                                                      \'TYPE\' => \'INT3\'\n                                                    },\n                                                    \'group_id\',\n                                                    {\n                                                      \'NOTNULL\' => 1,\n                                                      \'TYPE\' => \'INT3\'\n                                                    }\n                                                  ],\n                                      \'INDEXES\' => [\n                                                     \'namedquery_group_map_namedquery_id_idx\',\n                                                     {\n                                                       \'FIELDS\' => [\n                                                                     \'namedquery_id\'\n                                                                   ],\n                                                       \'TYPE\' => \'UNIQUE\'\n                                                     },\n                                                     \'namedquery_group_map_group_id_idx\',\n                                                     [\n                                                       \'group_id\'\n                                                     ]\n                                                   ]\n                                    },\n          \'op_sys\' => {\n                        \'FIELDS\' => [\n                                      \'id\',\n                                      {\n                                        \'NOTNULL\' => 1,\n                                        \'PRIMARYKEY\' => 1,\n                                        \'TYPE\' => \'SMALLSERIAL\'\n                                      },\n                                      \'value\',\n                                      {\n                                        \'NOTNULL\' => 1,\n                                        \'TYPE\' => \'varchar(64)\'\n                                      },\n                                      \'sortkey\',\n                                      {\n                                        \'DEFAULT\' => 0,\n                                        \'NOTNULL\' => 1,\n                                        \'TYPE\' => \'INT2\'\n                                      },\n                                      \'isactive\',\n                                      {\n                                        \'DEFAULT\' => \'TRUE\',\n                                        \'NOTNULL\' => 1,\n                                        \'TYPE\' => \'BOOLEAN\'\n                                      }\n                                    ],\n                        \'INDEXES\' => [\n                                       \'op_sys_value_idx\',\n                                       {\n                                         \'FIELDS\' => [\n                                                       \'value\'\n                                                     ],\n                                         \'TYPE\' => \'UNIQUE\'\n                                       },\n                                       \'op_sys_sortkey_idx\',\n                                       [\n                                         \'sortkey\',\n                                         \'value\'\n                                       ]\n                                     ]\n                      },\n          \'priority\' => {\n                          \'FIELDS\' => [\n                                        \'id\',\n                                        {\n                                          \'NOTNULL\' => 1,\n                                          \'PRIMARYKEY\' => 1,\n                                          \'TYPE\' => \'SMALLSERIAL\'\n                                        },\n                                        \'value\',\n                                        {\n                                          \'NOTNULL\' => 1,\n                                          \'TYPE\' => \'varchar(64)\'\n                                        },\n                                        \'sortkey\',\n                                        {\n                                          \'DEFAULT\' => 0,\n                                          \'NOTNULL\' => 1,\n                                          \'TYPE\' => \'INT2\'\n                                        },\n                                        \'isactive\',\n                                        {\n                                          \'DEFAULT\' => \'TRUE\',\n                                          \'NOTNULL\' => 1,\n                                          \'TYPE\' => \'BOOLEAN\'\n                                        }\n                                      ],\n                          \'INDEXES\' => [\n                                         \'priority_value_idx\',\n                                         {\n                                           \'FIELDS\' => [\n                                                         \'value\'\n                                                       ],\n                                           \'TYPE\' => \'UNIQUE\'\n                                         },\n                                         \'priority_sortkey_idx\',\n                                         [\n                                           \'sortkey\',\n                                           \'value\'\n                                         ]\n                                       ]\n                        },\n          \'products\' => {\n                          \'FIELDS\' => [\n                                        \'id\',\n                                        {\n                                          \'NOTNULL\' => 1,\n                                          \'PRIMARYKEY\' => 1,\n                                          \'TYPE\' => \'SMALLSERIAL\'\n                                        },\n                                        \'name\',\n                                        {\n                                          \'NOTNULL\' => 1,\n                                          \'TYPE\' => \'varchar(64)\'\n                                        },\n                                        \'classification_id\',\n                                        {\n                                          \'DEFAULT\' => \'1\',\n                                          \'NOTNULL\' => 1,\n                                          \'TYPE\' => \'INT2\'\n                                        },\n                                        \'description\',\n                                        {\n                                          \'TYPE\' => \'MEDIUMTEXT\'\n                                        },\n                                        \'milestoneurl\',\n                                        {\n                                          \'DEFAULT\' => \'\\\'\\\'\',\n                                          \'NOTNULL\' => 1,\n                                          \'TYPE\' => \'TINYTEXT\'\n                                        },\n                                        \'disallownew\',\n                                        {\n                                          \'DEFAULT\' => 0,\n                                          \'NOTNULL\' => 1,\n                                          \'TYPE\' => \'BOOLEAN\'\n                                        },\n                                        \'votesperuser\',\n                                        {\n                                          \'DEFAULT\' => 0,\n                                          \'NOTNULL\' => 1,\n                                          \'TYPE\' => \'INT2\'\n                                        },\n                                        \'maxvotesperbug\',\n                                        {\n                                          \'DEFAULT\' => \'10000\',\n                                          \'NOTNULL\' => 1,\n                                          \'TYPE\' => \'INT2\'\n                                        },\n                                        \'votestoconfirm\',\n                                        {\n                                          \'DEFAULT\' => 0,\n                                          \'NOTNULL\' => 1,\n                                          \'TYPE\' => \'INT2\'\n                                        },\n                                        \'defaultmilestone\',\n                                        {\n                                          \'DEFAULT\' => \'\\\'---\\\'\',\n                                          \'NOTNULL\' => 1,\n                                          \'TYPE\' => \'varchar(20)\'\n                                        }\n                                      ],\n                          \'INDEXES\' => [\n                                         \'products_name_idx\',\n                                         {\n                                           \'FIELDS\' => [\n                                                         \'name\'\n                                                       ],\n                                           \'TYPE\' => \'UNIQUE\'\n                                         }\n                                       ]\n                        },\n          \'profile_setting\' => {\n                                 \'FIELDS\' => [\n                                               \'user_id\',\n                                               {\n                                                 \'NOTNULL\' => 1,\n                                                 \'TYPE\' => \'INT3\'\n                                               },\n                                               \'setting_name\',\n                                               {\n                                                 \'NOTNULL\' => 1,\n                                                 \'TYPE\' => \'varchar(32)\'\n                                               },\n                                               \'setting_value\',\n                                               {\n                                                 \'NOTNULL\' => 1,\n                                                 \'TYPE\' => \'varchar(32)\'\n                                               }\n                                             ],\n                                 \'INDEXES\' => [\n                                                \'profile_setting_value_unique_idx\',\n                                                {\n                                                  \'FIELDS\' => [\n                                                                \'user_id\',\n                                                                \'setting_name\'\n                                                              ],\n                                                  \'TYPE\' => \'UNIQUE\'\n                                                }\n                                              ]\n                               },\n          \'profiles\' => {\n                          \'FIELDS\' => [\n                                        \'userid\',\n                                        {\n                                          \'NOTNULL\' => 1,\n                                          \'PRIMARYKEY\' => 1,\n                                          \'TYPE\' => \'MEDIUMSERIAL\'\n                                        },\n                                        \'login_name\',\n                                        {\n                                          \'NOTNULL\' => 1,\n                                          \'TYPE\' => \'varchar(255)\'\n                                        },\n                                        \'cryptpassword\',\n                                        {\n                                          \'TYPE\' => \'varchar(128)\'\n                                        },\n                                        \'realname\',\n                                        {\n                                          \'DEFAULT\' => \'\\\'\\\'\',\n                                          \'NOTNULL\' => 1,\n                                          \'TYPE\' => \'varchar(255)\'\n                                        },\n                                        \'disabledtext\',\n                                        {\n                                          \'DEFAULT\' => \'\\\'\\\'\',\n                                          \'NOTNULL\' => 1,\n                                          \'TYPE\' => \'MEDIUMTEXT\'\n                                        },\n                                        \'disable_mail\',\n                                        {\n                                          \'DEFAULT\' => \'FALSE\',\n                                          \'NOTNULL\' => 1,\n                                          \'TYPE\' => \'BOOLEAN\'\n                                        },\n                                        \'mybugslink\',\n                                        {\n                                          \'DEFAULT\' => \'TRUE\',\n                                          \'NOTNULL\' => 1,\n                                          \'TYPE\' => \'BOOLEAN\'\n                                        },\n                                        \'extern_id\',\n                                        {\n                                          \'TYPE\' => \'varchar(64)\'\n                                        }\n                                      ],\n                          \'INDEXES\' => [\n                                         \'profiles_login_name_idx\',\n                                         {\n                                           \'FIELDS\' => [\n                                                         \'login_name\'\n                                                       ],\n                                           \'TYPE\' => \'UNIQUE\'\n                                         }\n                                       ]\n                        },\n          \'profiles_activity\' => {\n                                   \'FIELDS\' => [\n                                                 \'userid\',\n                                                 {\n                                                   \'NOTNULL\' => 1,\n                                                   \'TYPE\' => \'INT3\'\n                                                 },\n                                                 \'who\',\n                                                 {\n                                                   \'NOTNULL\' => 1,\n                                                   \'TYPE\' => \'INT3\'\n                                                 },\n                                                 \'profiles_when\',\n                                                 {\n                                                   \'NOTNULL\' => 1,\n                                                   \'TYPE\' => \'DATETIME\'\n                                                 },\n                                                 \'fieldid\',\n                                                 {\n                                                   \'NOTNULL\' => 1,\n                                                   \'TYPE\' => \'INT3\'\n                                                 },\n                                                 \'oldvalue\',\n                                                 {\n                                                   \'TYPE\' => \'TINYTEXT\'\n                                                 },\n                                                 \'newvalue\',\n                                                 {\n                                                   \'TYPE\' => \'TINYTEXT\'\n                                                 }\n                                               ],\n                                   \'INDEXES\' => [\n                                                  \'profiles_activity_userid_idx\',\n                                                  [\n                                                    \'userid\'\n                                                  ],\n                                                  \'profiles_activity_profiles_when_idx\',\n                                                  [\n                                                    \'profiles_when\'\n                                                  ],\n                                                  \'profiles_activity_fieldid_idx\',\n                                                  [\n                                                    \'fieldid\'\n                                                  ]\n                                                ]\n                                 },\n          \'quips\' => {\n                       \'FIELDS\' => [\n                                     \'quipid\',\n                                     {\n                                       \'NOTNULL\' => 1,\n                                       \'PRIMARYKEY\' => 1,\n                                       \'TYPE\' => \'MEDIUMSERIAL\'\n                                     },\n                                     \'userid\',\n                                     {\n                                       \'TYPE\' => \'INT3\'\n                                     },\n                                     \'quip\',\n                                     {\n                                       \'NOTNULL\' => 1,\n                                       \'TYPE\' => \'TEXT\'\n                                     },\n                                     \'approved\',\n                                     {\n                                       \'DEFAULT\' => \'TRUE\',\n                                       \'NOTNULL\' => 1,\n                                       \'TYPE\' => \'BOOLEAN\'\n                                     }\n                                   ]\n                     },\n          \'rep_platform\' => {\n                              \'FIELDS\' => [\n                                            \'id\',\n                                            {\n                                              \'NOTNULL\' => 1,\n                                              \'PRIMARYKEY\' => 1,\n                                              \'TYPE\' => \'SMALLSERIAL\'\n                                            },\n                                            \'value\',\n                                            {\n                                              \'NOTNULL\' => 1,\n                                              \'TYPE\' => \'varchar(64)\'\n                                            },\n                                            \'sortkey\',\n                                            {\n                                              \'DEFAULT\' => 0,\n                                              \'NOTNULL\' => 1,\n                                              \'TYPE\' => \'INT2\'\n                                            },\n                                            \'isactive\',\n                                            {\n                                              \'DEFAULT\' => \'TRUE\',\n                                              \'NOTNULL\' => 1,\n                                              \'TYPE\' => \'BOOLEAN\'\n                                            }\n                                          ],\n                              \'INDEXES\' => [\n                                             \'rep_platform_value_idx\',\n                                             {\n                                               \'FIELDS\' => [\n                                                             \'value\'\n                                                           ],\n                                               \'TYPE\' => \'UNIQUE\'\n                                             },\n                                             \'rep_platform_sortkey_idx\',\n                                             [\n                                               \'sortkey\',\n                                               \'value\'\n                                             ]\n                                           ]\n                            },\n          \'resolution\' => {\n                            \'FIELDS\' => [\n                                          \'id\',\n                                          {\n                                            \'NOTNULL\' => 1,\n                                            \'PRIMARYKEY\' => 1,\n                                            \'TYPE\' => \'SMALLSERIAL\'\n                                          },\n                                          \'value\',\n                                          {\n                                            \'NOTNULL\' => 1,\n                                            \'TYPE\' => \'varchar(64)\'\n                                          },\n                                          \'sortkey\',\n                                          {\n                                            \'DEFAULT\' => 0,\n                                            \'NOTNULL\' => 1,\n                                            \'TYPE\' => \'INT2\'\n                                          },\n                                          \'isactive\',\n                                          {\n                                            \'DEFAULT\' => \'TRUE\',\n                                            \'NOTNULL\' => 1,\n                                            \'TYPE\' => \'BOOLEAN\'\n                                          }\n                                        ],\n                            \'INDEXES\' => [\n                                           \'resolution_value_idx\',\n                                           {\n                                             \'FIELDS\' => [\n                                                           \'value\'\n                                                         ],\n                                             \'TYPE\' => \'UNIQUE\'\n                                           },\n                                           \'resolution_sortkey_idx\',\n                                           [\n                                             \'sortkey\',\n                                             \'value\'\n                                           ]\n                                         ]\n                          },\n          \'series\' => {\n                        \'FIELDS\' => [\n                                      \'series_id\',\n                                      {\n                                        \'NOTNULL\' => 1,\n                                        \'PRIMARYKEY\' => 1,\n                                        \'TYPE\' => \'MEDIUMSERIAL\'\n                                      },\n                                      \'creator\',\n                                      {\n                                        \'TYPE\' => \'INT3\'\n                                      },\n                                      \'category\',\n                                      {\n                                        \'NOTNULL\' => 1,\n                                        \'TYPE\' => \'INT2\'\n                                      },\n                                      \'subcategory\',\n                                      {\n                                        \'NOTNULL\' => 1,\n                                        \'TYPE\' => \'INT2\'\n                                      },\n                                      \'name\',\n                                      {\n                                        \'NOTNULL\' => 1,\n                                        \'TYPE\' => \'varchar(64)\'\n                                      },\n                                      \'frequency\',\n                                      {\n                                        \'NOTNULL\' => 1,\n                                        \'TYPE\' => \'INT2\'\n                                      },\n                                      \'last_viewed\',\n                                      {\n                                        \'TYPE\' => \'DATETIME\'\n                                      },\n                                      \'query\',\n                                      {\n                                        \'NOTNULL\' => 1,\n                                        \'TYPE\' => \'MEDIUMTEXT\'\n                                      },\n                                      \'is_public\',\n                                      {\n                                        \'DEFAULT\' => \'FALSE\',\n                                        \'NOTNULL\' => 1,\n                                        \'TYPE\' => \'BOOLEAN\'\n                                      }\n                                    ],\n                        \'INDEXES\' => [\n                                       \'series_creator_idx\',\n                                       {\n                                         \'FIELDS\' => [\n                                                       \'creator\',\n                                                       \'category\',\n                                                       \'subcategory\',\n                                                       \'name\'\n                                                     ],\n                                         \'TYPE\' => \'UNIQUE\'\n                                       }\n                                     ]\n                      },\n          \'series_categories\' => {\n                                   \'FIELDS\' => [\n                                                 \'id\',\n                                                 {\n                                                   \'NOTNULL\' => 1,\n                                                   \'PRIMARYKEY\' => 1,\n                                                   \'TYPE\' => \'SMALLSERIAL\'\n                                                 },\n                                                 \'name\',\n                                                 {\n                                                   \'NOTNULL\' => 1,\n                                                   \'TYPE\' => \'varchar(64)\'\n                                                 }\n                                               ],\n                                   \'INDEXES\' => [\n                                                  \'series_categories_name_idx\',\n                                                  {\n                                                    \'FIELDS\' => [\n                                                                  \'name\'\n                                                                ],\n                                                    \'TYPE\' => \'UNIQUE\'\n                                                  }\n                                                ]\n                                 },\n          \'series_data\' => {\n                             \'FIELDS\' => [\n                                           \'series_id\',\n                                           {\n                                             \'NOTNULL\' => 1,\n                                             \'TYPE\' => \'INT3\'\n                                           },\n                                           \'series_date\',\n                                           {\n                                             \'NOTNULL\' => 1,\n                                             \'TYPE\' => \'DATETIME\'\n                                           },\n                                           \'series_value\',\n                                           {\n                                             \'NOTNULL\' => 1,\n                                             \'TYPE\' => \'INT3\'\n                                           }\n                                         ],\n                             \'INDEXES\' => [\n                                            \'series_data_series_id_idx\',\n                                            {\n                                              \'FIELDS\' => [\n                                                            \'series_id\',\n                                                            \'series_date\'\n                                                          ],\n                                              \'TYPE\' => \'UNIQUE\'\n                                            }\n                                          ]\n                           },\n          \'setting\' => {\n                         \'FIELDS\' => [\n                                       \'name\',\n                                       {\n                                         \'NOTNULL\' => 1,\n                                         \'PRIMARYKEY\' => 1,\n                                         \'TYPE\' => \'varchar(32)\'\n                                       },\n                                       \'default_value\',\n                                       {\n                                         \'NOTNULL\' => 1,\n                                         \'TYPE\' => \'varchar(32)\'\n                                       },\n                                       \'is_enabled\',\n                                       {\n                                         \'DEFAULT\' => \'TRUE\',\n                                         \'NOTNULL\' => 1,\n                                         \'TYPE\' => \'BOOLEAN\'\n                                       },\n                                       \'subclass\',\n                                       {\n                                         \'TYPE\' => \'varchar(32)\'\n                                       }\n                                     ]\n                       },\n          \'setting_value\' => {\n                               \'FIELDS\' => [\n                                             \'name\',\n                                             {\n                                               \'NOTNULL\' => 1,\n                                               \'TYPE\' => \'varchar(32)\'\n                                             },\n                                             \'value\',\n                                             {\n                                               \'NOTNULL\' => 1,\n                                               \'TYPE\' => \'varchar(32)\'\n                                             },\n                                             \'sortindex\',\n                                             {\n                                               \'NOTNULL\' => 1,\n                                               \'TYPE\' => \'INT2\'\n                                             }\n                                           ],\n                               \'INDEXES\' => [\n                                              \'setting_value_nv_unique_idx\',\n                                              {\n                                                \'FIELDS\' => [\n                                                              \'name\',\n                                                              \'value\'\n                                                            ],\n                                                \'TYPE\' => \'UNIQUE\'\n                                              },\n                                              \'setting_value_ns_unique_idx\',\n                                              {\n                                                \'FIELDS\' => [\n                                                              \'name\',\n                                                              \'sortindex\'\n                                                            ],\n                                                \'TYPE\' => \'UNIQUE\'\n                                              }\n                                            ]\n                             },\n          \'test_attachment_data\' => {\n                                      \'FIELDS\' => [\n                                                    \'attachment_id\',\n                                                    {\n                                                      \'NOTNULL\' => 1,\n                                                      \'TYPE\' => \'INT4\',\n                                                      \'UNSIGNED\' => 1\n                                                    },\n                                                    \'contents\',\n                                                    {\n                                                      \'TYPE\' => \'LONGBLOB\'\n                                                    }\n                                                  ],\n                                      \'INDEXES\' => [\n                                                     \'test_attachment_data_primary_idx\',\n                                                     [\n                                                       \'attachment_id\'\n                                                     ]\n                                                   ]\n                                    },\n          \'test_attachments\' => {\n                                  \'FIELDS\' => [\n                                                \'attachment_id\',\n                                                {\n                                                  \'NOTNULL\' => 1,\n                                                  \'PRIMARYKEY\' => 1,\n                                                  \'TYPE\' => \'INTSERIAL\'\n                                                },\n                                                \'submitter_id\',\n                                                {\n                                                  \'NOTNULL\' => 1,\n                                                  \'TYPE\' => \'INT3\'\n                                                },\n                                                \'description\',\n                                                {\n                                                  \'TYPE\' => \'MEDIUMTEXT\'\n                                                },\n                                                \'filename\',\n                                                {\n                                                  \'TYPE\' => \'MEDIUMTEXT\'\n                                                },\n                                                \'creation_ts\',\n                                                {\n                                                  \'NOTNULL\' => 1,\n                                                  \'TYPE\' => \'DATETIME\'\n                                                },\n                                                \'mime_type\',\n                                                {\n                                                  \'NOTNULL\' => 1,\n                                                  \'TYPE\' => \'varchar(100)\'\n                                                }\n                                              ],\n                                  \'INDEXES\' => [\n                                                 \'test_attachments_submitter_idx\',\n                                                 [\n                                                   \'submitter_id\'\n                                                 ]\n                                               ]\n                                },\n          \'test_builds\' => {\n                             \'FIELDS\' => [\n                                           \'build_id\',\n                                           {\n                                             \'NOTNULL\' => 1,\n                                             \'PRIMARYKEY\' => 1,\n                                             \'TYPE\' => \'INTSERIAL\'\n                                           },\n                                           \'product_id\',\n                                           {\n                                             \'NOTNULL\' => 1,\n                                             \'TYPE\' => \'INT2\'\n                                           },\n                                           \'milestone\',\n                                           {\n                                             \'TYPE\' => \'varchar(20)\'\n                                           },\n                                           \'name\',\n                                           {\n                                             \'TYPE\' => \'varchar(255)\'\n                                           },\n                                           \'description\',\n                                           {\n                                             \'TYPE\' => \'TEXT\'\n                                           },\n                                           \'isactive\',\n                                           {\n                                             \'DEFAULT\' => \'1\',\n                                             \'NOTNULL\' => 1,\n                                             \'TYPE\' => \'BOOLEAN\'\n                                           }\n                                         ],\n                             \'INDEXES\' => [\n                                            \'build_name_idx\',\n                                            [\n                                              \'name\'\n                                            ],\n                                            \'build_milestone_idx\',\n                                            [\n                                              \'milestone\'\n                                            ],\n                                            \'build_product_id_name_idx\',\n                                            {\n                                              \'FIELDS\' => [\n                                                            \'product_id\',\n                                                            \'name\'\n                                                          ],\n                                              \'TYPE\' => \'UNIQUE\'\n                                            },\n                                            \'build_prod_idx\',\n                                            {\n                                              \'FIELDS\' => [\n                                                            \'build_id\',\n                                                            \'product_id\'\n                                                          ],\n                                              \'TYPE\' => \'UNIQUE\'\n                                            }\n                                          ]\n                           },\n          \'test_case_activity\' => {\n                                    \'FIELDS\' => [\n                                                  \'case_id\',\n                                                  {\n                                                    \'NOTNULL\' => 1,\n                                                    \'TYPE\' => \'INT4\',\n                                                    \'UNSIGNED\' => 1\n                                                  },\n                                                  \'fieldid\',\n                                                  {\n                                                    \'NOTNULL\' => 1,\n                                                    \'TYPE\' => \'INT2\',\n                                                    \'UNSIGNED\' => 1\n                                                  },\n                                                  \'who\',\n                                                  {\n                                                    \'NOTNULL\' => 1,\n                                                    \'TYPE\' => \'INT3\'\n                                                  },\n                                                  \'changed\',\n                                                  {\n                                                    \'NOTNULL\' => 1,\n                                                    \'TYPE\' => \'DATETIME\'\n                                                  },\n                                                  \'oldvalue\',\n                                                  {\n                                                    \'TYPE\' => \'MEDIUMTEXT\'\n                                                  },\n                                                  \'newvalue\',\n                                                  {\n                                                    \'TYPE\' => \'MEDIUMTEXT\'\n                                                  }\n                                                ],\n                                    \'INDEXES\' => [\n                                                   \'case_activity_case_id_idx\',\n                                                   [\n                                                     \'case_id\'\n                                                   ],\n                                                   \'case_activity_who_idx\',\n                                                   [\n                                                     \'who\'\n                                                   ],\n                                                   \'case_activity_when_idx\',\n                                                   [\n                                                     \'changed\'\n                                                   ],\n                                                   \'case_activity_field_idx\',\n                                                   [\n                                                     \'fieldid\'\n                                                   ]\n                                                 ]\n                                  },\n          \'test_case_attachments\' => {\n                                       \'FIELDS\' => [\n                                                     \'attachment_id\',\n                                                     {\n                                                       \'NOTNULL\' => 1,\n                                                       \'TYPE\' => \'INT4\'\n                                                     },\n                                                     \'case_id\',\n                                                     {\n                                                       \'NOTNULL\' => 1,\n                                                       \'TYPE\' => \'INT4\',\n                                                       \'UNSIGNED\' => 1\n                                                     },\n                                                     \'case_run_id\',\n                                                     {\n                                                       \'TYPE\' => \'INT4\',\n                                                       \'UNSIGNED\' => 1\n                                                     }\n                                                   ],\n                                       \'INDEXES\' => [\n                                                      \'test_case_attachments_primary_idx\',\n                                                      [\n                                                        \'attachment_id\'\n                                                      ],\n                                                      \'attachment_case_id_idx\',\n                                                      [\n                                                        \'case_id\'\n                                                      ],\n                                                      \'attachment_caserun_id_idx\',\n                                                      [\n                                                        \'case_run_id\'\n                                                      ]\n                                                    ]\n                                     },\n          \'test_case_bugs\' => {\n                                \'FIELDS\' => [\n                                              \'bug_id\',\n                                              {\n                                                \'NOTNULL\' => 1,\n                                                \'TYPE\' => \'INT3\'\n                                              },\n                                              \'case_run_id\',\n                                              {\n                                                \'TYPE\' => \'INT4\',\n                                                \'UNSIGNED\' => 1\n                                              },\n                                              \'case_id\',\n                                              {\n                                                \'NOTNULL\' => 1,\n                                                \'TYPE\' => \'INT4\',\n                                                \'UNSIGNED\' => 1\n                                              }\n                                            ],\n                                \'INDEXES\' => [\n                                               \'case_bugs_bug_id_idx\',\n                                               [\n                                                 \'bug_id\'\n                                               ],\n                                               \'case_bugs_case_id_idx\',\n                                               [\n                                                 \'case_id\'\n                                               ],\n                                               \'case_bugs_case_run_id_idx\',\n                                               [\n                                                 \'case_run_id\'\n                                               ]\n                                             ]\n                              },\n          \'test_case_categories\' => {\n                                      \'FIELDS\' => [\n                                                    \'category_id\',\n                                                    {\n                                                      \'NOTNULL\' => 1,\n                                                      \'PRIMARYKEY\' => 1,\n                                                      \'TYPE\' => \'SMALLSERIAL\'\n                                                    },\n                                                    \'product_id\',\n                                                    {\n                                                      \'NOTNULL\' => 1,\n                                                      \'TYPE\' => \'INT2\'\n                                                    },\n                                                    \'name\',\n                                                    {\n                                                      \'NOTNULL\' => 1,\n                                                      \'TYPE\' => \'varchar(240)\'\n                                                    },\n                                                    \'description\',\n                                                    {\n                                                      \'TYPE\' => \'MEDIUMTEXT\'\n                                                    }\n                                                  ],\n                                      \'INDEXES\' => [\n                                                     \'category_product_id_name_idx\',\n                                                     {\n                                                       \'FIELDS\' => [\n                                                                     \'product_id\',\n                                                                     \'name\'\n                                                                   ],\n                                                       \'TYPE\' => \'UNIQUE\'\n                                                     },\n                                                     \'category_product_idx\',\n                                                     {\n                                                       \'FIELDS\' => [\n                                                                     \'category_id\',\n                                                                     \'product_id\'\n                                                                   ],\n                                                       \'TYPE\' => \'UNIQUE\'\n                                                     },\n                                                     \'category_name_idx_v2\',\n                                                     [\n                                                       \'name\'\n                                                     ]\n                                                   ]\n                                    },\n          \'test_case_components\' => {\n                                      \'FIELDS\' => [\n                                                    \'case_id\',\n                                                    {\n                                                      \'NOTNULL\' => 1,\n                                                      \'TYPE\' => \'INT4\',\n                                                      \'UNSIGNED\' => 1\n                                                    },\n                                                    \'component_id\',\n                                                    {\n                                                      \'NOTNULL\' => 1,\n                                                      \'TYPE\' => \'INT2\'\n                                                    }\n                                                  ],\n                                      \'INDEXES\' => [\n                                                     \'components_case_id_idx\',\n                                                     {\n                                                       \'FIELDS\' => [\n                                                                     \'case_id\',\n                                                                     \'component_id\'\n                                                                   ],\n                                                       \'TYPE\' => \'UNIQUE\'\n                                                     },\n                                                     \'components_component_id_idx\',\n                                                     [\n                                                       \'component_id\'\n                                                     ]\n                                                   ]\n                                    },\n          \'test_case_dependencies\' => {\n                                        \'FIELDS\' => [\n                                                      \'dependson\',\n                                                      {\n                                                        \'NOTNULL\' => 1,\n                                                        \'TYPE\' => \'INT4\',\n                                                        \'UNSIGNED\' => 1\n                                                      },\n                                                      \'blocked\',\n                                                      {\n                                                        \'NOTNULL\' => 1,\n                                                        \'TYPE\' => \'INT4\',\n                                                        \'UNSIGNED\' => 1\n                                                      }\n                                                    ],\n                                        \'INDEXES\' => [\n                                                       \'case_dependencies_primary_idx\',\n                                                       {\n                                                         \'FIELDS\' => [\n                                                                       \'dependson\',\n                                                                       \'blocked\'\n                                                                     ],\n                                                         \'TYPE\' => \'UNIQUE\'\n                                                       },\n                                                       \'case_dependencies_blocked_idx\',\n                                                       [\n                                                         \'blocked\'\n                                                       ]\n                                                     ]\n                                      },\n          \'test_case_plans\' => {\n                                 \'FIELDS\' => [\n                                               \'plan_id\',\n                                               {\n                                                 \'NOTNULL\' => 1,\n                                                 \'TYPE\' => \'INT4\',\n                                                 \'UNSIGNED\' => 1\n                                               },\n                                               \'case_id\',\n                                               {\n                                                 \'NOTNULL\' => 1,\n                                                 \'TYPE\' => \'INT4\',\n                                                 \'UNSIGNED\' => 1\n                                               }\n                                             ],\n                                 \'INDEXES\' => [\n                                                \'test_case_plans_primary_idx\',\n                                                {\n                                                  \'FIELDS\' => [\n                                                                \'plan_id\',\n                                                                \'case_id\'\n                                                              ],\n                                                  \'TYPE\' => \'UNIQUE\'\n                                                },\n                                                \'test_case_plans_case_idx\',\n                                                [\n                                                  \'case_id\'\n                                                ]\n                                              ]\n                               },\n          \'test_case_run_status\' => {\n                                      \'FIELDS\' => [\n                                                    \'case_run_status_id\',\n                                                    {\n                                                      \'NOTNULL\' => 1,\n                                                      \'PRIMARYKEY\' => 1,\n                                                      \'TYPE\' => \'SMALLSERIAL\'\n                                                    },\n                                                    \'name\',\n                                                    {\n                                                      \'TYPE\' => \'varchar(20)\'\n                                                    },\n                                                    \'sortkey\',\n                                                    {\n                                                      \'TYPE\' => \'INT4\'\n                                                    },\n                                                    \'description\',\n                                                    {\n                                                      \'TYPE\' => \'TEXT\'\n                                                    }\n                                                  ]\n                                    },\n          \'test_case_runs\' => {\n                                \'FIELDS\' => [\n                                              \'case_run_id\',\n                                              {\n                                                \'NOTNULL\' => 1,\n                                                \'PRIMARYKEY\' => 1,\n                                                \'TYPE\' => \'INTSERIAL\'\n                                              },\n                                              \'run_id\',\n                                              {\n                                                \'NOTNULL\' => 1,\n                                                \'TYPE\' => \'INT4\',\n                                                \'UNSIGNED\' => 1\n                                              },\n                                              \'case_id\',\n                                              {\n                                                \'NOTNULL\' => 1,\n                                                \'TYPE\' => \'INT4\',\n                                                \'UNSIGNED\' => 1\n                                              },\n                                              \'assignee\',\n                                              {\n                                                \'TYPE\' => \'INT3\'\n                                              },\n                                              \'testedby\',\n                                              {\n                                                \'TYPE\' => \'INT3\'\n                                              },\n                                              \'case_run_status_id\',\n                                              {\n                                                \'NOTNULL\' => 1,\n                                                \'TYPE\' => \'INT1\',\n                                                \'UNSIGNED\' => 1\n                                              },\n                                              \'case_text_version\',\n                                              {\n                                                \'NOTNULL\' => 1,\n                                                \'TYPE\' => \'INT3\'\n                                              },\n                                              \'build_id\',\n                                              {\n                                                \'NOTNULL\' => 1,\n                                                \'TYPE\' => \'INT4\',\n                                                \'UNSIGNED\' => 1\n                                              },\n                                              \'running_date\',\n                                              {\n                                                \'TYPE\' => \'DATETIME\'\n                                              },\n                                              \'close_date\',\n                                              {\n                                                \'TYPE\' => \'DATETIME\'\n                                              },\n                                              \'notes\',\n                                              {\n                                                \'TYPE\' => \'TEXT\'\n                                              },\n                                              \'iscurrent\',\n                                              {\n                                                \'DEFAULT\' => \'0\',\n                                                \'NOTNULL\' => 1,\n                                                \'TYPE\' => \'BOOLEAN\'\n                                              },\n                                              \'sortkey\',\n                                              {\n                                                \'TYPE\' => \'INT4\'\n                                              },\n                                              \'environment_id\',\n                                              {\n                                                \'NOTNULL\' => 1,\n                                                \'TYPE\' => \'INT4\',\n                                                \'UNSIGNED\' => 1\n                                              }\n                                            ],\n                                \'INDEXES\' => [\n                                               \'case_run_case_id_idx\',\n                                               [\n                                                 \'case_id\'\n                                               ],\n                                               \'case_run_assignee_idx\',\n                                               [\n                                                 \'assignee\'\n                                               ],\n                                               \'case_run_testedby_idx\',\n                                               [\n                                                 \'testedby\'\n                                               ],\n                                               \'case_run_close_date_idx\',\n                                               [\n                                                 \'close_date\'\n                                               ],\n                                               \'case_run_build_env_idx\',\n                                               {\n                                                 \'FIELDS\' => [\n                                                               \'run_id\',\n                                                               \'case_id\',\n                                                               \'build_id\',\n                                                               \'environment_id\'\n                                                             ],\n                                                 \'TYPE\' => \'UNIQUE\'\n                                               },\n                                               \'case_run_status_idx\',\n                                               [\n                                                 \'case_run_status_id\'\n                                               ],\n                                               \'case_run_text_ver_idx\',\n                                               [\n                                                 \'case_text_version\'\n                                               ],\n                                               \'case_run_build_idx_v2\',\n                                               [\n                                                 \'build_id\'\n                                               ],\n                                               \'case_run_env_idx_v2\',\n                                               [\n                                                 \'environment_id\'\n                                               ]\n                                             ]\n                              },\n          \'test_case_status\' => {\n                                  \'FIELDS\' => [\n                                                \'case_status_id\',\n                                                {\n                                                  \'NOTNULL\' => 1,\n                                                  \'PRIMARYKEY\' => 1,\n                                                  \'TYPE\' => \'SMALLSERIAL\'\n                                                },\n                                                \'name\',\n                                                {\n                                                  \'NOTNULL\' => 1,\n                                                  \'TYPE\' => \'varchar(255)\'\n                                                },\n                                                \'description\',\n                                                {\n                                                  \'TYPE\' => \'TEXT\'\n                                                }\n                                              ]\n                                },\n          \'test_case_tags\' => {\n                                \'FIELDS\' => [\n                                              \'tag_id\',\n                                              {\n                                                \'NOTNULL\' => 1,\n                                                \'TYPE\' => \'INT4\',\n                                                \'UNSIGNED\' => 1\n                                              },\n                                              \'case_id\',\n                                              {\n                                                \'NOTNULL\' => 1,\n                                                \'TYPE\' => \'INT4\',\n                                                \'UNSIGNED\' => 1\n                                              },\n                                              \'userid\',\n                                              {\n                                                \'NOTNULL\' => 1,\n                                                \'TYPE\' => \'INT3\'\n                                              }\n                                            ],\n                                \'INDEXES\' => [\n                                               \'case_tags_primary_idx\',\n                                               {\n                                                 \'FIELDS\' => [\n                                                               \'tag_id\',\n                                                               \'case_id\',\n                                                               \'userid\'\n                                                             ],\n                                                 \'TYPE\' => \'UNIQUE\'\n                                               },\n                                               \'case_tags_secondary_idx\',\n                                               {\n                                                 \'FIELDS\' => [\n                                                               \'tag_id\',\n                                                               \'case_id\'\n                                                             ],\n                                                 \'TYPE\' => \'UNIQUE\'\n                                               },\n                                               \'case_tags_case_id_idx_v3\',\n                                               [\n                                                 \'case_id\'\n                                               ],\n                                               \'case_tags_userid_idx\',\n                                               [\n                                                 \'userid\'\n                                               ]\n                                             ]\n                              },\n          \'test_case_texts\' => {\n                                 \'FIELDS\' => [\n                                               \'case_id\',\n                                               {\n                                                 \'NOTNULL\' => 1,\n                                                 \'TYPE\' => \'INT4\',\n                                                 \'UNSIGNED\' => 1\n                                               },\n                                               \'case_text_version\',\n                                               {\n                                                 \'NOTNULL\' => 1,\n                                                 \'TYPE\' => \'INT3\'\n                                               },\n                                               \'who\',\n                                               {\n                                                 \'NOTNULL\' => 1,\n                                                 \'TYPE\' => \'INT3\'\n                                               },\n                                               \'creation_ts\',\n                                               {\n                                                 \'NOTNULL\' => 1,\n                                                 \'TYPE\' => \'DATETIME\'\n                                               },\n                                               \'action\',\n                                               {\n                                                 \'TYPE\' => \'MEDIUMTEXT\'\n                                               },\n                                               \'effect\',\n                                               {\n                                                 \'TYPE\' => \'MEDIUMTEXT\'\n                                               },\n                                               \'setup\',\n                                               {\n                                                 \'TYPE\' => \'MEDIUMTEXT\'\n                                               },\n                                               \'breakdown\',\n                                               {\n                                                 \'TYPE\' => \'MEDIUMTEXT\'\n                                               }\n                                             ],\n                                 \'INDEXES\' => [\n                                                \'case_versions_idx\',\n                                                {\n                                                  \'FIELDS\' => [\n                                                                \'case_id\',\n                                                                \'case_text_version\'\n                                                              ],\n                                                  \'TYPE\' => \'UNIQUE\'\n                                                },\n                                                \'case_versions_who_idx\',\n                                                [\n                                                  \'who\'\n                                                ],\n                                                \'case_versions_creation_ts_idx\',\n                                                [\n                                                  \'creation_ts\'\n                                                ]\n                                              ]\n                               },\n          \'test_cases\' => {\n                            \'FIELDS\' => [\n                                          \'case_id\',\n                                          {\n                                            \'NOTNULL\' => 1,\n                                            \'PRIMARYKEY\' => 1,\n                                            \'TYPE\' => \'INTSERIAL\'\n                                          },\n                                          \'case_status_id\',\n                                          {\n                                            \'NOTNULL\' => 1,\n                                            \'TYPE\' => \'INT1\'\n                                          },\n                                          \'category_id\',\n                                          {\n                                            \'NOTNULL\' => 1,\n                                            \'TYPE\' => \'INT2\',\n                                            \'UNSIGNED\' => 1\n                                          },\n                                          \'priority_id\',\n                                          {\n                                            \'TYPE\' => \'INT2\'\n                                          },\n                                          \'author_id\',\n                                          {\n                                            \'NOTNULL\' => 1,\n                                            \'TYPE\' => \'INT3\'\n                                          },\n                                          \'default_tester_id\',\n                                          {\n                                            \'TYPE\' => \'INT3\'\n                                          },\n                                          \'creation_date\',\n                                          {\n                                            \'NOTNULL\' => 1,\n                                            \'TYPE\' => \'DATETIME\'\n                                          },\n                                          \'estimated_time\',\n                                          {\n                                            \'TYPE\' => \'TIME\'\n                                          },\n                                          \'isautomated\',\n                                          {\n                                            \'DEFAULT\' => \'0\',\n                                            \'NOTNULL\' => 1,\n                                            \'TYPE\' => \'BOOLEAN\'\n                                          },\n                                          \'sortkey\',\n                                          {\n                                            \'TYPE\' => \'INT4\'\n                                          },\n                                          \'script\',\n                                          {\n                                            \'TYPE\' => \'MEDIUMTEXT\'\n                                          },\n                                          \'arguments\',\n                                          {\n                                            \'TYPE\' => \'MEDIUMTEXT\'\n                                          },\n                                          \'summary\',\n                                          {\n                                            \'TYPE\' => \'varchar(255)\'\n                                          },\n                                          \'requirement\',\n                                          {\n                                            \'TYPE\' => \'varchar(255)\'\n                                          },\n                                          \'alias\',\n                                          {\n                                            \'TYPE\' => \'varchar(255)\'\n                                          }\n                                        ],\n                            \'INDEXES\' => [\n                                           \'test_case_category_idx\',\n                                           [\n                                             \'category_id\'\n                                           ],\n                                           \'test_case_author_idx\',\n                                           [\n                                             \'author_id\'\n                                           ],\n                                           \'test_case_creation_date_idx\',\n                                           [\n                                             \'creation_date\'\n                                           ],\n                                           \'test_case_sortkey_idx\',\n                                           [\n                                             \'sortkey\'\n                                           ],\n                                           \'test_case_shortname_idx\',\n                                           [\n                                             \'alias\'\n                                           ],\n                                           \'test_case_requirement_idx\',\n                                           [\n                                             \'requirement\'\n                                           ],\n                                           \'test_case_status_idx\',\n                                           [\n                                             \'case_status_id\'\n                                           ],\n                                           \'test_case_tester_idx\',\n                                           [\n                                             \'default_tester_id\'\n                                           ]\n                                         ]\n                          },\n          \'test_email_settings\' => {\n                                     \'FIELDS\' => [\n                                                   \'userid\',\n                                                   {\n                                                     \'NOTNULL\' => 1,\n                                                     \'TYPE\' => \'INT3\'\n                                                   },\n                                                   \'eventid\',\n                                                   {\n                                                     \'NOTNULL\' => 1,\n                                                     \'TYPE\' => \'INT1\',\n                                                     \'UNSIGNED\' => 1\n                                                   },\n                                                   \'relationship_id\',\n                                                   {\n                                                     \'NOTNULL\' => 1,\n                                                     \'TYPE\' => \'INT1\',\n                                                     \'UNSIGNED\' => 1\n                                                   }\n                                                 ],\n                                     \'INDEXES\' => [\n                                                    \'test_email_setting_user_id_idx\',\n                                                    {\n                                                      \'FIELDS\' => [\n                                                                    \'userid\',\n                                                                    \'relationship_id\',\n                                                                    \'eventid\'\n                                                                  ],\n                                                      \'TYPE\' => \'UNIQUE\'\n                                                    }\n                                                  ]\n                                   },\n          \'test_environment_category\' => {\n                                           \'FIELDS\' => [\n                                                         \'env_category_id\',\n                                                         {\n                                                           \'NOTNULL\' => 1,\n                                                           \'PRIMARYKEY\' => 1,\n                                                           \'TYPE\' => \'INTSERIAL\'\n                                                         },\n                                                         \'product_id\',\n                                                         {\n                                                           \'NOTNULL\' => 1,\n                                                           \'TYPE\' => \'INT2\'\n                                                         },\n                                                         \'name\',\n                                                         {\n                                                           \'TYPE\' => \'varchar(255)\'\n                                                         }\n                                                       ],\n                                           \'INDEXES\' => [\n                                                          \'test_environment_category_key1\',\n                                                          {\n                                                            \'FIELDS\' => [\n                                                                          \'env_category_id\',\n                                                                          \'product_id\'\n                                                                        ],\n                                                            \'TYPE\' => \'UNIQUE\'\n                                                          },\n                                                          \'test_environment_category_key2\',\n                                                          {\n                                                            \'FIELDS\' => [\n                                                                          \'product_id\',\n                                                                          \'name\'\n                                                                        ],\n                                                            \'TYPE\' => \'UNIQUE\'\n                                                          }\n                                                        ]\n                                         },\n          \'test_environment_element\' => {\n                                          \'FIELDS\' => [\n                                                        \'element_id\',\n                                                        {\n                                                          \'NOTNULL\' => 1,\n                                                          \'PRIMARYKEY\' => 1,\n                                                          \'TYPE\' => \'INTSERIAL\'\n                                                        },\n                                                        \'env_category_id\',\n                                                        {\n                                                          \'NOTNULL\' => 1,\n                                                          \'TYPE\' => \'INT4\',\n                                                          \'UNSIGNED\' => 1\n                                                        },\n                                                        \'name\',\n                                                        {\n                                                          \'TYPE\' => \'varchar(255)\'\n                                                        },\n                                                        \'parent_id\',\n                                                        {\n                                                          \'TYPE\' => \'INT4\',\n                                                          \'UNSIGNED\' => 1\n                                                        },\n                                                        \'isprivate\',\n                                                        {\n                                                          \'DEFAULT\' => 0,\n                                                          \'NOTNULL\' => 1,\n                                                          \'TYPE\' => \'BOOLEAN\'\n                                                        }\n                                                      ],\n                                          \'INDEXES\' => [\n                                                         \'test_environment_element_key1\',\n                                                         {\n                                                           \'FIELDS\' => [\n                                                                         \'element_id\',\n                                                                         \'env_category_id\'\n                                                                       ],\n                                                           \'TYPE\' => \'UNIQUE\'\n                                                         },\n                                                         \'test_environment_element_key2\',\n                                                         {\n                                                           \'FIELDS\' => [\n                                                                         \'env_category_id\',\n                                                                         \'name\'\n                                                                       ],\n                                                           \'TYPE\' => \'UNIQUE\'\n                                                         }\n                                                       ]\n                                        },\n          \'test_environment_map\' => {\n                                      \'FIELDS\' => [\n                                                    \'environment_id\',\n                                                    {\n                                                      \'NOTNULL\' => 1,\n                                                      \'TYPE\' => \'INT4\',\n                                                      \'UNSIGNED\' => 1\n                                                    },\n                                                    \'property_id\',\n                                                    {\n                                                      \'NOTNULL\' => 1,\n                                                      \'TYPE\' => \'INT4\',\n                                                      \'UNSIGNED\' => 1\n                                                    },\n                                                    \'element_id\',\n                                                    {\n                                                      \'NOTNULL\' => 1,\n                                                      \'TYPE\' => \'INT4\',\n                                                      \'UNSIGNED\' => 1\n                                                    },\n                                                    \'value_selected\',\n                                                    {\n                                                      \'TYPE\' => \'TINYTEXT\'\n                                                    }\n                                                  ],\n                                      \'INDEXES\' => [\n                                                     \'env_map_env_element_idx\',\n                                                     [\n                                                       \'environment_id\',\n                                                       \'element_id\'\n                                                     ],\n                                                     \'env_map_property_idx\',\n                                                     [\n                                                       \'environment_id\',\n                                                       \'property_id\'\n                                                     ],\n                                                     \'test_environment_map_key3\',\n                                                     {\n                                                       \'FIELDS\' => [\n                                                                     \'environment_id\',\n                                                                     \'element_id\',\n                                                                     \'property_id\'\n                                                                   ],\n                                                       \'TYPE\' => \'UNIQUE\'\n                                                     }\n                                                   ]\n                                    },\n          \'test_environment_property\' => {\n                                           \'FIELDS\' => [\n                                                         \'property_id\',\n                                                         {\n                                                           \'NOTNULL\' => 1,\n                                                           \'PRIMARYKEY\' => 1,\n                                                           \'TYPE\' => \'INTSERIAL\'\n                                                         },\n                                                         \'element_id\',\n                                                         {\n                                                           \'NOTNULL\' => 1,\n                                                           \'TYPE\' => \'INT4\',\n                                                           \'UNSIGNED\' => 1\n                                                         },\n                                                         \'name\',\n                                                         {\n                                                           \'TYPE\' => \'varchar(255)\'\n                                                         },\n                                                         \'validexp\',\n                                                         {\n                                                           \'TYPE\' => \'TEXT\'\n                                                         }\n                                                       ],\n                                           \'INDEXES\' => [\n                                                          \'test_environment_property_key1\',\n                                                          {\n                                                            \'FIELDS\' => [\n                                                                          \'property_id\',\n                                                                          \'element_id\'\n                                                                        ],\n                                                            \'TYPE\' => \'UNIQUE\'\n                                                          },\n                                                          \'test_environment_property_key2\',\n                                                          {\n                                                            \'FIELDS\' => [\n                                                                          \'element_id\',\n                                                                          \'name\'\n                                                                        ],\n                                                            \'TYPE\' => \'UNIQUE\'\n                                                          }\n                                                        ]\n                                         },\n          \'test_environments\' => {\n                                   \'FIELDS\' => [\n                                                 \'environment_id\',\n                                                 {\n                                                   \'NOTNULL\' => 1,\n                                                   \'PRIMARYKEY\' => 1,\n                                                   \'TYPE\' => \'INTSERIAL\'\n                                                 },\n                                                 \'product_id\',\n                                                 {\n                                                   \'NOTNULL\' => 1,\n                                                   \'TYPE\' => \'INT2\'\n                                                 },\n                                                 \'name\',\n                                                 {\n                                                   \'TYPE\' => \'varchar(255)\'\n                                                 },\n                                                 \'isactive\',\n                                                 {\n                                                   \'DEFAULT\' => \'1\',\n                                                   \'NOTNULL\' => 1,\n                                                   \'TYPE\' => \'BOOLEAN\'\n                                                 }\n                                               ],\n                                   \'INDEXES\' => [\n                                                  \'test_environments_key1\',\n                                                  {\n                                                    \'FIELDS\' => [\n                                                                  \'environment_id\',\n                                                                  \'product_id\'\n                                                                ],\n                                                    \'TYPE\' => \'UNIQUE\'\n                                                  },\n                                                  \'test_environments_key2\',\n                                                  {\n                                                    \'FIELDS\' => [\n                                                                  \'product_id\',\n                                                                  \'name\'\n                                                                ],\n                                                    \'TYPE\' => \'UNIQUE\'\n                                                  },\n                                                  \'environment_name_idx_v2\',\n                                                  [\n                                                    \'name\'\n                                                  ]\n                                                ]\n                                 },\n          \'test_events\' => {\n                             \'FIELDS\' => [\n                                           \'eventid\',\n                                           {\n                                             \'NOTNULL\' => 1,\n                                             \'PRIMARYKEY\' => 1,\n                                             \'TYPE\' => \'INT1\',\n                                             \'UNSIGNED\' => 1\n                                           },\n                                           \'name\',\n                                           {\n                                             \'TYPE\' => \'varchar(50)\'\n                                           }\n                                         ],\n                             \'INDEXES\' => [\n                                            \'test_event_name_idx\',\n                                            [\n                                              \'name\'\n                                            ]\n                                          ]\n                           },\n          \'test_fielddefs\' => {\n                                \'FIELDS\' => [\n                                              \'fieldid\',\n                                              {\n                                                \'NOTNULL\' => 1,\n                                                \'PRIMARYKEY\' => 1,\n                                                \'TYPE\' => \'SMALLSERIAL\'\n                                              },\n                                              \'name\',\n                                              {\n                                                \'NOTNULL\' => 1,\n                                                \'TYPE\' => \'varchar(100)\'\n                                              },\n                                              \'description\',\n                                              {\n                                                \'TYPE\' => \'MEDIUMTEXT\'\n                                              },\n                                              \'table_name\',\n                                              {\n                                                \'NOTNULL\' => 1,\n                                                \'TYPE\' => \'varchar(100)\'\n                                              }\n                                            ]\n                              },\n          \'test_named_queries\' => {\n                                    \'FIELDS\' => [\n                                                  \'userid\',\n                                                  {\n                                                    \'NOTNULL\' => 1,\n                                                    \'TYPE\' => \'INT3\'\n                                                  },\n                                                  \'name\',\n                                                  {\n                                                    \'NOTNULL\' => 1,\n                                                    \'TYPE\' => \'varchar(64)\'\n                                                  },\n                                                  \'isvisible\',\n                                                  {\n                                                    \'DEFAULT\' => 1,\n                                                    \'NOTNULL\' => 1,\n                                                    \'TYPE\' => \'BOOLEAN\'\n                                                  },\n                                                  \'query\',\n                                                  {\n                                                    \'NOTNULL\' => 1,\n                                                    \'TYPE\' => \'MEDIUMTEXT\'\n                                                  },\n                                                  \'type\',\n                                                  {\n                                                    \'DEFAULT\' => 0,\n                                                    \'NOTNULL\' => 1,\n                                                    \'TYPE\' => \'INT3\'\n                                                  }\n                                                ],\n                                    \'INDEXES\' => [\n                                                   \'test_namedquery_primary_idx\',\n                                                   {\n                                                     \'FIELDS\' => [\n                                                                   \'userid\',\n                                                                   \'name\'\n                                                                 ],\n                                                     \'TYPE\' => \'UNIQUE\'\n                                                   },\n                                                   \'test_namedquery_name_idx\',\n                                                   [\n                                                     \'name\'\n                                                   ]\n                                                 ]\n                                  },\n          \'test_plan_activity\' => {\n                                    \'FIELDS\' => [\n                                                  \'plan_id\',\n                                                  {\n                                                    \'NOTNULL\' => 1,\n                                                    \'TYPE\' => \'INT4\',\n                                                    \'UNSIGNED\' => 1\n                                                  },\n                                                  \'fieldid\',\n                                                  {\n                                                    \'NOTNULL\' => 1,\n                                                    \'TYPE\' => \'INT2\',\n                                                    \'UNSIGNED\' => 1\n                                                  },\n                                                  \'who\',\n                                                  {\n                                                    \'NOTNULL\' => 1,\n                                                    \'TYPE\' => \'INT3\'\n                                                  },\n                                                  \'changed\',\n                                                  {\n                                                    \'NOTNULL\' => 1,\n                                                    \'TYPE\' => \'DATETIME\'\n                                                  },\n                                                  \'oldvalue\',\n                                                  {\n                                                    \'TYPE\' => \'MEDIUMTEXT\'\n                                                  },\n                                                  \'newvalue\',\n                                                  {\n                                                    \'TYPE\' => \'MEDIUMTEXT\'\n                                                  }\n                                                ],\n                                    \'INDEXES\' => [\n                                                   \'plan_activity_primary_idx\',\n                                                   [\n                                                     \'plan_id\'\n                                                   ],\n                                                   \'plan_activity_field_idx\',\n                                                   [\n                                                     \'fieldid\'\n                                                   ],\n                                                   \'plan_activity_who_idx\',\n                                                   [\n                                                     \'who\'\n                                                   ],\n                                                   \'plan_activity_changed_idx\',\n                                                   [\n                                                     \'changed\'\n                                                   ]\n                                                 ]\n                                  },\n          \'test_plan_attachments\' => {\n                                       \'FIELDS\' => [\n                                                     \'attachment_id\',\n                                                     {\n                                                       \'NOTNULL\' => 1,\n                                                       \'TYPE\' => \'INT4\'\n                                                     },\n                                                     \'plan_id\',\n                                                     {\n                                                       \'NOTNULL\' => 1,\n                                                       \'TYPE\' => \'INT4\',\n                                                       \'UNSIGNED\' => 1\n                                                     }\n                                                   ],\n                                       \'INDEXES\' => [\n                                                      \'test_plan_attachments_primary_idx\',\n                                                      [\n                                                        \'attachment_id\'\n                                                      ],\n                                                      \'attachment_plan_id_idx\',\n                                                      [\n                                                        \'plan_id\'\n                                                      ]\n                                                    ]\n                                     },\n          \'test_plan_permissions\' => {\n                                       \'FIELDS\' => [\n                                                     \'userid\',\n                                                     {\n                                                       \'NOTNULL\' => 1,\n                                                       \'TYPE\' => \'INT3\'\n                                                     },\n                                                     \'plan_id\',\n                                                     {\n                                                       \'NOTNULL\' => 1,\n                                                       \'TYPE\' => \'INT4\',\n                                                       \'UNSIGNED\' => 1\n                                                     },\n                                                     \'permissions\',\n                                                     {\n                                                       \'NOTNULL\' => 1,\n                                                       \'TYPE\' => \'INT1\'\n                                                     },\n                                                     \'grant_type\',\n                                                     {\n                                                       \'NOTNULL\' => 1,\n                                                       \'TYPE\' => \'INT1\'\n                                                     }\n                                                   ],\n                                       \'INDEXES\' => [\n                                                      \'testers_plan_user_idx\',\n                                                      {\n                                                        \'FIELDS\' => [\n                                                                      \'userid\',\n                                                                      \'plan_id\',\n                                                                      \'grant_type\'\n                                                                    ],\n                                                        \'TYPE\' => \'UNIQUE\'\n                                                      },\n                                                      \'testers_plan_user_plan_idx\',\n                                                      [\n                                                        \'plan_id\'\n                                                      ],\n                                                      \'testers_plan_grant_idx\',\n                                                      [\n                                                        \'grant_type\'\n                                                      ]\n                                                    ]\n                                     },\n          \'test_plan_permissions_regexp\' => {\n                                              \'FIELDS\' => [\n                                                            \'plan_id\',\n                                                            {\n                                                              \'NOTNULL\' => 1,\n                                                              \'TYPE\' => \'INT4\',\n                                                              \'UNSIGNED\' => 1\n                                                            },\n                                                            \'user_regexp\',\n                                                            {\n                                                              \'NOTNULL\' => 1,\n                                                              \'TYPE\' => \'TEXT\'\n                                                            },\n                                                            \'permissions\',\n                                                            {\n                                                              \'NOTNULL\' => 1,\n                                                              \'TYPE\' => \'INT1\'\n                                                            }\n                                                          ],\n                                              \'INDEXES\' => [\n                                                             \'testers_plan_regexp_idx\',\n                                                             {\n                                                               \'FIELDS\' => [\n                                                                             \'plan_id\'\n                                                                           ],\n                                                               \'TYPE\' => \'UNIQUE\'\n                                                             }\n                                                           ]\n                                            },\n          \'test_plan_tags\' => {\n                                \'FIELDS\' => [\n                                              \'tag_id\',\n                                              {\n                                                \'NOTNULL\' => 1,\n                                                \'TYPE\' => \'INT4\',\n                                                \'UNSIGNED\' => 1\n                                              },\n                                              \'plan_id\',\n                                              {\n                                                \'NOTNULL\' => 1,\n                                                \'TYPE\' => \'INT4\',\n                                                \'UNSIGNED\' => 1\n                                              },\n                                              \'userid\',\n                                              {\n                                                \'NOTNULL\' => 1,\n                                                \'TYPE\' => \'INT3\'\n                                              }\n                                            ],\n                                \'INDEXES\' => [\n                                               \'plan_tags_primary_idx\',\n                                               {\n                                                 \'FIELDS\' => [\n                                                               \'tag_id\',\n                                                               \'plan_id\',\n                                                               \'userid\'\n                                                             ],\n                                                 \'TYPE\' => \'UNIQUE\'\n                                               },\n                                               \'plan_tags_secondary_idx\',\n                                               {\n                                                 \'FIELDS\' => [\n                                                               \'tag_id\',\n                                                               \'plan_id\'\n                                                             ],\n                                                 \'TYPE\' => \'UNIQUE\'\n                                               },\n                                               \'plan_tags_plan_id_idx\',\n                                               [\n                                                 \'plan_id\'\n                                               ],\n                                               \'plan_tags_userid_idx\',\n                                               [\n                                                 \'userid\'\n                                               ]\n                                             ]\n                              },\n          \'test_plan_texts\' => {\n                                 \'FIELDS\' => [\n                                               \'plan_id\',\n                                               {\n                                                 \'NOTNULL\' => 1,\n                                                 \'TYPE\' => \'INT4\',\n                                                 \'UNSIGNED\' => 1\n                                               },\n                                               \'plan_text_version\',\n                                               {\n                                                 \'NOTNULL\' => 1,\n                                                 \'TYPE\' => \'INT4\'\n                                               },\n                                               \'who\',\n                                               {\n                                                 \'NOTNULL\' => 1,\n                                                 \'TYPE\' => \'INT3\'\n                                               },\n                                               \'creation_ts\',\n                                               {\n                                                 \'NOTNULL\' => 1,\n                                                 \'TYPE\' => \'DATETIME\'\n                                               },\n                                               \'plan_text\',\n                                               {\n                                                 \'TYPE\' => \'MEDIUMTEXT\'\n                                               }\n                                             ],\n                                 \'INDEXES\' => [\n                                                \'test_plan_text_version_idx\',\n                                                [\n                                                  \'plan_id\',\n                                                  \'plan_text_version\'\n                                                ],\n                                                \'test_plan_text_who_idx\',\n                                                [\n                                                  \'who\'\n                                                ]\n                                              ]\n                               },\n          \'test_plan_types\' => {\n                                 \'FIELDS\' => [\n                                               \'type_id\',\n                                               {\n                                                 \'NOTNULL\' => 1,\n                                                 \'PRIMARYKEY\' => 1,\n                                                 \'TYPE\' => \'SMALLSERIAL\'\n                                               },\n                                               \'name\',\n                                               {\n                                                 \'NOTNULL\' => 1,\n                                                 \'TYPE\' => \'varchar(64)\'\n                                               },\n                                               \'description\',\n                                               {\n                                                 \'TYPE\' => \'MEDIUMTEXT\'\n                                               }\n                                             ]\n                               },\n          \'test_plans\' => {\n                            \'FIELDS\' => [\n                                          \'plan_id\',\n                                          {\n                                            \'NOTNULL\' => 1,\n                                            \'PRIMARYKEY\' => 1,\n                                            \'TYPE\' => \'INTSERIAL\'\n                                          },\n                                          \'product_id\',\n                                          {\n                                            \'NOTNULL\' => 1,\n                                            \'TYPE\' => \'INT2\'\n                                          },\n                                          \'author_id\',\n                                          {\n                                            \'NOTNULL\' => 1,\n                                            \'TYPE\' => \'INT3\'\n                                          },\n                                          \'type_id\',\n                                          {\n                                            \'NOTNULL\' => 1,\n                                            \'TYPE\' => \'INT1\',\n                                            \'UNSIGNED\' => 1\n                                          },\n                                          \'default_product_version\',\n                                          {\n                                            \'NOTNULL\' => 1,\n                                            \'TYPE\' => \'MEDIUMTEXT\'\n                                          },\n                                          \'name\',\n                                          {\n                                            \'NOTNULL\' => 1,\n                                            \'TYPE\' => \'varchar(255)\'\n                                          },\n                                          \'creation_date\',\n                                          {\n                                            \'NOTNULL\' => 1,\n                                            \'TYPE\' => \'DATETIME\'\n                                          },\n                                          \'isactive\',\n                                          {\n                                            \'DEFAULT\' => \'1\',\n                                            \'NOTNULL\' => 1,\n                                            \'TYPE\' => \'BOOLEAN\'\n                                          }\n                                        ],\n                            \'INDEXES\' => [\n                                           \'plan_product_plan_id_idx\',\n                                           [\n                                             \'product_id\',\n                                             \'plan_id\'\n                                           ],\n                                           \'plan_author_idx\',\n                                           [\n                                             \'author_id\'\n                                           ],\n                                           \'plan_type_idx\',\n                                           [\n                                             \'type_id\'\n                                           ],\n                                           \'plan_isactive_idx\',\n                                           [\n                                             \'isactive\'\n                                           ],\n                                           \'plan_name_idx\',\n                                           [\n                                             \'name\'\n                                           ]\n                                         ]\n                          },\n          \'test_relationships\' => {\n                                    \'FIELDS\' => [\n                                                  \'relationship_id\',\n                                                  {\n                                                    \'NOTNULL\' => 1,\n                                                    \'PRIMARYKEY\' => 1,\n                                                    \'TYPE\' => \'INT1\',\n                                                    \'UNSIGNED\' => 1\n                                                  },\n                                                  \'name\',\n                                                  {\n                                                    \'TYPE\' => \'varchar(50)\'\n                                                  }\n                                                ]\n                                  },\n          \'test_run_activity\' => {\n                                   \'FIELDS\' => [\n                                                 \'run_id\',\n                                                 {\n                                                   \'NOTNULL\' => 1,\n                                                   \'TYPE\' => \'INT4\',\n                                                   \'UNSIGNED\' => 1\n                                                 },\n                                                 \'fieldid\',\n                                                 {\n                                                   \'NOTNULL\' => 1,\n                                                   \'TYPE\' => \'INT2\',\n                                                   \'UNSIGNED\' => 1\n                                                 },\n                                                 \'who\',\n                                                 {\n                                                   \'NOTNULL\' => 1,\n                                                   \'TYPE\' => \'INT3\'\n                                                 },\n                                                 \'changed\',\n                                                 {\n                                                   \'NOTNULL\' => 1,\n                                                   \'TYPE\' => \'DATETIME\'\n                                                 },\n                                                 \'oldvalue\',\n                                                 {\n                                                   \'TYPE\' => \'MEDIUMTEXT\'\n                                                 },\n                                                 \'newvalue\',\n                                                 {\n                                                   \'TYPE\' => \'MEDIUMTEXT\'\n                                                 }\n                                               ],\n                                   \'INDEXES\' => [\n                                                  \'run_activity_run_id_idx\',\n                                                  [\n                                                    \'run_id\'\n                                                  ],\n                                                  \'run_activity_field_idx\',\n                                                  [\n                                                    \'fieldid\'\n                                                  ],\n                                                  \'run_activity_who_idx\',\n                                                  [\n                                                    \'who\'\n                                                  ],\n                                                  \'run_activity_when_idx\',\n                                                  [\n                                                    \'changed\'\n                                                  ]\n                                                ]\n                                 },\n          \'test_run_cc\' => {\n                             \'FIELDS\' => [\n                                           \'run_id\',\n                                           {\n                                             \'NOTNULL\' => 1,\n                                             \'TYPE\' => \'INT4\',\n                                             \'UNSIGNED\' => 1\n                                           },\n                                           \'who\',\n                                           {\n                                             \'NOTNULL\' => 1,\n                                             \'TYPE\' => \'INT3\'\n                                           }\n                                         ],\n                             \'INDEXES\' => [\n                                            \'test_run_cc_primary_idx\',\n                                            {\n                                              \'FIELDS\' => [\n                                                            \'run_id\',\n                                                            \'who\'\n                                                          ],\n                                              \'TYPE\' => \'UNIQUE\'\n                                            },\n                                            \'test_run_cc_who_idx\',\n                                            [\n                                              \'who\'\n                                            ]\n                                          ]\n                           },\n          \'test_run_tags\' => {\n                               \'FIELDS\' => [\n                                             \'tag_id\',\n                                             {\n                                               \'NOTNULL\' => 1,\n                                               \'TYPE\' => \'INT4\',\n                                               \'UNSIGNED\' => 1\n                                             },\n                                             \'run_id\',\n                                             {\n                                               \'NOTNULL\' => 1,\n                                               \'TYPE\' => \'INT4\',\n                                               \'UNSIGNED\' => 1\n                                             },\n                                             \'userid\',\n                                             {\n                                               \'NOTNULL\' => 1,\n                                               \'TYPE\' => \'INT3\'\n                                             }\n                                           ],\n                               \'INDEXES\' => [\n                                              \'run_tags_primary_idx\',\n                                              {\n                                                \'FIELDS\' => [\n                                                              \'tag_id\',\n                                                              \'run_id\',\n                                                              \'userid\'\n                                                            ],\n                                                \'TYPE\' => \'UNIQUE\'\n                                              },\n                                              \'run_tags_secondary_idx\',\n                                              {\n                                                \'FIELDS\' => [\n                                                              \'tag_id\',\n                                                              \'run_id\'\n                                                            ],\n                                                \'TYPE\' => \'UNIQUE\'\n                                              },\n                                              \'run_tags_run_id_idx\',\n                                              [\n                                                \'run_id\'\n                                              ],\n                                              \'run_tags_userid_idx\',\n                                              [\n                                                \'userid\'\n                                              ]\n                                            ]\n                             },\n          \'test_runs\' => {\n                           \'FIELDS\' => [\n                                         \'run_id\',\n                                         {\n                                           \'NOTNULL\' => 1,\n                                           \'PRIMARYKEY\' => 1,\n                                           \'TYPE\' => \'INTSERIAL\'\n                                         },\n                                         \'plan_id\',\n                                         {\n                                           \'NOTNULL\' => 1,\n                                           \'TYPE\' => \'INT4\',\n                                           \'UNSIGNED\' => 1\n                                         },\n                                         \'environment_id\',\n                                         {\n                                           \'NOTNULL\' => 1,\n                                           \'TYPE\' => \'INT4\',\n                                           \'UNSIGNED\' => 1\n                                         },\n                                         \'product_version\',\n                                         {\n                                           \'TYPE\' => \'MEDIUMTEXT\'\n                                         },\n                                         \'build_id\',\n                                         {\n                                           \'NOTNULL\' => 1,\n                                           \'TYPE\' => \'INT4\',\n                                           \'UNSIGNED\' => 1\n                                         },\n                                         \'plan_text_version\',\n                                         {\n                                           \'NOTNULL\' => 1,\n                                           \'TYPE\' => \'INT4\'\n                                         },\n                                         \'manager_id\',\n                                         {\n                                           \'NOTNULL\' => 1,\n                                           \'TYPE\' => \'INT3\'\n                                         },\n                                         \'default_tester_id\',\n                                         {\n                                           \'TYPE\' => \'INT3\'\n                                         },\n                                         \'start_date\',\n                                         {\n                                           \'NOTNULL\' => 1,\n                                           \'TYPE\' => \'DATETIME\'\n                                         },\n                                         \'stop_date\',\n                                         {\n                                           \'TYPE\' => \'DATETIME\'\n                                         },\n                                         \'summary\',\n                                         {\n                                           \'NOTNULL\' => 1,\n                                           \'TYPE\' => \'TINYTEXT\'\n                                         },\n                                         \'notes\',\n                                         {\n                                           \'TYPE\' => \'MEDIUMTEXT\'\n                                         }\n                                       ],\n                           \'INDEXES\' => [\n                                          \'test_run_plan_id_run_id_idx\',\n                                          [\n                                            \'plan_id\',\n                                            \'run_id\'\n                                          ],\n                                          \'test_run_manager_idx\',\n                                          [\n                                            \'manager_id\'\n                                          ],\n                                          \'test_run_start_date_idx\',\n                                          [\n                                            \'start_date\'\n                                          ],\n                                          \'test_run_stop_date_idx\',\n                                          [\n                                            \'stop_date\'\n                                          ],\n                                          \'test_run_env_idx\',\n                                          [\n                                            \'environment_id\'\n                                          ],\n                                          \'test_run_build_idx\',\n                                          [\n                                            \'build_id\'\n                                          ],\n                                          \'test_run_plan_ver_idx\',\n                                          [\n                                            \'plan_text_version\'\n                                          ],\n                                          \'test_run_tester_idx\',\n                                          [\n                                            \'default_tester_id\'\n                                          ]\n                                        ]\n                         },\n          \'test_tags\' => {\n                           \'FIELDS\' => [\n                                         \'tag_id\',\n                                         {\n                                           \'NOTNULL\' => 1,\n                                           \'PRIMARYKEY\' => 1,\n                                           \'TYPE\' => \'INTSERIAL\'\n                                         },\n                                         \'tag_name\',\n                                         {\n                                           \'NOTNULL\' => 1,\n                                           \'TYPE\' => \'varchar(255)\'\n                                         }\n                                       ],\n                           \'INDEXES\' => [\n                                          \'test_tag_name_idx_v2\',\n                                          [\n                                            \'tag_name\'\n                                          ]\n                                        ]\n                         },\n          \'tokens\' => {\n                        \'FIELDS\' => [\n                                      \'userid\',\n                                      {\n                                        \'TYPE\' => \'INT3\'\n                                      },\n                                      \'issuedate\',\n                                      {\n                                        \'NOTNULL\' => 1,\n                                        \'TYPE\' => \'DATETIME\'\n                                      },\n                                      \'token\',\n                                      {\n                                        \'NOTNULL\' => 1,\n                                        \'PRIMARYKEY\' => 1,\n                                        \'TYPE\' => \'varchar(16)\'\n                                      },\n                                      \'tokentype\',\n                                      {\n                                        \'NOTNULL\' => 1,\n                                        \'TYPE\' => \'varchar(8)\'\n                                      },\n                                      \'eventdata\',\n                                      {\n                                        \'TYPE\' => \'TINYTEXT\'\n                                      }\n                                    ],\n                        \'INDEXES\' => [\n                                       \'tokens_userid_idx\',\n                                       [\n                                         \'userid\'\n                                       ]\n                                     ]\n                      },\n          \'user_group_map\' => {\n                                \'FIELDS\' => [\n                                              \'user_id\',\n                                              {\n                                                \'NOTNULL\' => 1,\n                                                \'TYPE\' => \'INT3\'\n                                              },\n                                              \'group_id\',\n                                              {\n                                                \'NOTNULL\' => 1,\n                                                \'TYPE\' => \'INT3\'\n                                              },\n                                              \'isbless\',\n                                              {\n                                                \'DEFAULT\' => \'FALSE\',\n                                                \'NOTNULL\' => 1,\n                                                \'TYPE\' => \'BOOLEAN\'\n                                              },\n                                              \'grant_type\',\n                                              {\n                                                \'DEFAULT\' => 0,\n                                                \'NOTNULL\' => 1,\n                                                \'TYPE\' => \'INT1\'\n                                              }\n                                            ],\n                                \'INDEXES\' => [\n                                               \'user_group_map_user_id_idx\',\n                                               {\n                                                 \'FIELDS\' => [\n                                                               \'user_id\',\n                                                               \'group_id\',\n                                                               \'grant_type\',\n                                                               \'isbless\'\n                                                             ],\n                                                 \'TYPE\' => \'UNIQUE\'\n                                               }\n                                             ]\n                              },\n          \'versions\' => {\n                          \'FIELDS\' => [\n                                        \'id\',\n                                        {\n                                          \'NOTNULL\' => 1,\n                                          \'PRIMARYKEY\' => 1,\n                                          \'TYPE\' => \'MEDIUMSERIAL\'\n                                        },\n                                        \'value\',\n                                        {\n                                          \'NOTNULL\' => 1,\n                                          \'TYPE\' => \'varchar(64)\'\n                                        },\n                                        \'product_id\',\n                                        {\n                                          \'NOTNULL\' => 1,\n                                          \'TYPE\' => \'INT2\'\n                                        }\n                                      ],\n                          \'INDEXES\' => [\n                                         \'versions_product_id_idx\',\n                                         {\n                                           \'FIELDS\' => [\n                                                         \'product_id\',\n                                                         \'value\'\n                                                       ],\n                                           \'TYPE\' => \'UNIQUE\'\n                                         }\n                                       ]\n                        },\n          \'votes\' => {\n                       \'FIELDS\' => [\n                                     \'who\',\n                                     {\n                                       \'NOTNULL\' => 1,\n                                       \'TYPE\' => \'INT3\'\n                                     },\n                                     \'bug_id\',\n                                     {\n                                       \'NOTNULL\' => 1,\n                                       \'TYPE\' => \'INT3\'\n                                     },\n                                     \'vote_count\',\n                                     {\n                                       \'NOTNULL\' => 1,\n                                       \'TYPE\' => \'INT2\'\n                                     }\n                                   ],\n                       \'INDEXES\' => [\n                                      \'votes_who_idx\',\n                                      [\n                                        \'who\'\n                                      ],\n                                      \'votes_bug_id_idx\',\n                                      [\n                                        \'bug_id\'\n                                      ]\n                                    ]\n                     },\n          \'watch\' => {\n                       \'FIELDS\' => [\n                                     \'watcher\',\n                                     {\n                                       \'NOTNULL\' => 1,\n                                       \'TYPE\' => \'INT3\'\n                                     },\n                                     \'watched\',\n                                     {\n                                       \'NOTNULL\' => 1,\n                                       \'TYPE\' => \'INT3\'\n                                     }\n                                   ],\n                       \'INDEXES\' => [\n                                      \'watch_watcher_idx\',\n                                      {\n                                        \'FIELDS\' => [\n                                                      \'watcher\',\n                                                      \'watched\'\n                                                    ],\n                                        \'TYPE\' => \'UNIQUE\'\n                                      },\n                                      \'watch_watched_idx\',\n                                      [\n                                        \'watched\'\n                                      ]\n                                    ]\n                     },\n          \'whine_events\' => {\n                              \'FIELDS\' => [\n                                            \'id\',\n                                            {\n                                              \'NOTNULL\' => 1,\n                                              \'PRIMARYKEY\' => 1,\n                                              \'TYPE\' => \'MEDIUMSERIAL\'\n                                            },\n                                            \'owner_userid\',\n                                            {\n                                              \'NOTNULL\' => 1,\n                                              \'TYPE\' => \'INT3\'\n                                            },\n                                            \'subject\',\n                                            {\n                                              \'TYPE\' => \'varchar(128)\'\n                                            },\n                                            \'body\',\n                                            {\n                                              \'TYPE\' => \'MEDIUMTEXT\'\n                                            }\n                                          ]\n                            },\n          \'whine_queries\' => {\n                               \'FIELDS\' => [\n                                             \'id\',\n                                             {\n                                               \'NOTNULL\' => 1,\n                                               \'PRIMARYKEY\' => 1,\n                                               \'TYPE\' => \'MEDIUMSERIAL\'\n                                             },\n                                             \'eventid\',\n                                             {\n                                               \'NOTNULL\' => 1,\n                                               \'TYPE\' => \'INT3\'\n                                             },\n                                             \'query_name\',\n                                             {\n                                               \'DEFAULT\' => \'\\\'\\\'\',\n                                               \'NOTNULL\' => 1,\n                                               \'TYPE\' => \'varchar(64)\'\n                                             },\n                                             \'sortkey\',\n                                             {\n                                               \'DEFAULT\' => \'0\',\n                                               \'NOTNULL\' => 1,\n                                               \'TYPE\' => \'INT2\'\n                                             },\n                                             \'onemailperbug\',\n                                             {\n                                               \'DEFAULT\' => \'FALSE\',\n                                               \'NOTNULL\' => 1,\n                                               \'TYPE\' => \'BOOLEAN\'\n                                             },\n                                             \'title\',\n                                             {\n                                               \'DEFAULT\' => \'\\\'\\\'\',\n                                               \'NOTNULL\' => 1,\n                                               \'TYPE\' => \'varchar(128)\'\n                                             }\n                                           ],\n                               \'INDEXES\' => [\n                                              \'whine_queries_eventid_idx\',\n                                              [\n                                                \'eventid\'\n                                              ]\n                                            ]\n                             },\n          \'whine_schedules\' => {\n                                 \'FIELDS\' => [\n                                               \'id\',\n                                               {\n                                                 \'NOTNULL\' => 1,\n                                                 \'PRIMARYKEY\' => 1,\n                                                 \'TYPE\' => \'MEDIUMSERIAL\'\n                                               },\n                                               \'eventid\',\n                                               {\n                                                 \'NOTNULL\' => 1,\n                                                 \'TYPE\' => \'INT3\'\n                                               },\n                                               \'run_day\',\n                                               {\n                                                 \'TYPE\' => \'varchar(32)\'\n                                               },\n                                               \'run_time\',\n                                               {\n                                                 \'TYPE\' => \'varchar(32)\'\n                                               },\n                                               \'run_next\',\n                                               {\n                                                 \'TYPE\' => \'DATETIME\'\n                                               },\n                                               \'mailto\',\n                                               {\n                                                 \'NOTNULL\' => 1,\n                                                 \'TYPE\' => \'INT3\'\n                                               },\n                                               \'mailto_type\',\n                                               {\n                                                 \'DEFAULT\' => \'0\',\n                                                 \'NOTNULL\' => 1,\n                                                 \'TYPE\' => \'INT2\'\n                                               }\n                                             ],\n                                 \'INDEXES\' => [\n                                                \'whine_schedules_run_next_idx\',\n                                                [\n                                                  \'run_next\'\n                                                ],\n                                                \'whine_schedules_eventid_idx\',\n                                                [\n                                                  \'eventid\'\n                                                ]\n                                              ]\n                               }\n        };\n','2.00');
/*!40000 ALTER TABLE `bz_schema` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `category_group_map`
--

DROP TABLE IF EXISTS `category_group_map`;
CREATE TABLE `category_group_map` (
  `category_id` smallint(6) NOT NULL,
  `group_id` mediumint(9) NOT NULL,
  UNIQUE KEY `category_group_map_category_id_idx` (`category_id`,`group_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Dumping data for table `category_group_map`
--

LOCK TABLES `category_group_map` WRITE;
/*!40000 ALTER TABLE `category_group_map` DISABLE KEYS */;
/*!40000 ALTER TABLE `category_group_map` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cc`
--

DROP TABLE IF EXISTS `cc`;
CREATE TABLE `cc` (
  `bug_id` mediumint(9) NOT NULL,
  `who` mediumint(9) NOT NULL,
  UNIQUE KEY `cc_bug_id_idx` (`bug_id`,`who`),
  KEY `cc_who_idx` (`who`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Dumping data for table `cc`
--

LOCK TABLES `cc` WRITE;
/*!40000 ALTER TABLE `cc` DISABLE KEYS */;
/*!40000 ALTER TABLE `cc` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `classifications`
--

DROP TABLE IF EXISTS `classifications`;
CREATE TABLE `classifications` (
  `id` smallint(6) NOT NULL auto_increment,
  `name` varchar(64) NOT NULL,
  `description` mediumtext,
  `sortkey` smallint(6) NOT NULL default '0',
  PRIMARY KEY  (`id`),
  UNIQUE KEY `classifications_name_idx` (`name`)
) ENGINE=MyISAM AUTO_INCREMENT=4 DEFAULT CHARSET=utf8;

--
-- Dumping data for table `classifications`
--

LOCK TABLES `classifications` WRITE;
/*!40000 ALTER TABLE `classifications` DISABLE KEYS */;
INSERT INTO `classifications` VALUES (1,'PUBLIC','Publicly available products',0),(2,'PARTNER','Products visible to partners',0),(3,'PRIVATE','Products that are only visible internally.',0);
/*!40000 ALTER TABLE `classifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `component_cc`
--

DROP TABLE IF EXISTS `component_cc`;
CREATE TABLE `component_cc` (
  `user_id` mediumint(9) NOT NULL,
  `component_id` smallint(6) NOT NULL,
  UNIQUE KEY `component_cc_user_id_idx` (`component_id`,`user_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Dumping data for table `component_cc`
--

LOCK TABLES `component_cc` WRITE;
/*!40000 ALTER TABLE `component_cc` DISABLE KEYS */;
/*!40000 ALTER TABLE `component_cc` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `components`
--

DROP TABLE IF EXISTS `components`;
CREATE TABLE `components` (
  `id` smallint(6) NOT NULL auto_increment,
  `name` varchar(64) NOT NULL,
  `product_id` smallint(6) NOT NULL,
  `initialowner` mediumint(9) NOT NULL,
  `initialqacontact` mediumint(9) default NULL,
  `description` mediumtext NOT NULL,
  `disallownew` tinyint(4) NOT NULL default '0',
  PRIMARY KEY  (`id`),
  UNIQUE KEY `components_product_id_idx` (`product_id`,`name`),
  KEY `components_name_idx` (`name`)
) ENGINE=MyISAM AUTO_INCREMENT=5 DEFAULT CHARSET=utf8;

--
-- Dumping data for table `components`
--

LOCK TABLES `components` WRITE;
/*!40000 ALTER TABLE `components` DISABLE KEYS */;
INSERT INTO `components` VALUES (1,'PUBLIC ONE COMP 1',1,4,5,'PUBLIC ONE COMP 1',0),(2,'PUBLIC ONE COMP 2',1,4,5,'PUBLIC ONE COMP 2',0),(3,'PRIVATE ONE COMP 1',2,7,8,'PRIVATE ONE COMP 1',0),(4,'PARTNER ONE COMP 1',3,2,6,'PARTNER ONE COMP 1',0);
/*!40000 ALTER TABLE `components` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `dependencies`
--

DROP TABLE IF EXISTS `dependencies`;
CREATE TABLE `dependencies` (
  `blocked` mediumint(9) NOT NULL,
  `dependson` mediumint(9) NOT NULL,
  KEY `dependencies_blocked_idx` (`blocked`),
  KEY `dependencies_dependson_idx` (`dependson`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Dumping data for table `dependencies`
--

LOCK TABLES `dependencies` WRITE;
/*!40000 ALTER TABLE `dependencies` DISABLE KEYS */;
/*!40000 ALTER TABLE `dependencies` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `duplicates`
--

DROP TABLE IF EXISTS `duplicates`;
CREATE TABLE `duplicates` (
  `dupe_of` mediumint(9) NOT NULL,
  `dupe` mediumint(9) NOT NULL,
  PRIMARY KEY  (`dupe`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Dumping data for table `duplicates`
--

LOCK TABLES `duplicates` WRITE;
/*!40000 ALTER TABLE `duplicates` DISABLE KEYS */;
/*!40000 ALTER TABLE `duplicates` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `email_setting`
--

DROP TABLE IF EXISTS `email_setting`;
CREATE TABLE `email_setting` (
  `user_id` mediumint(9) NOT NULL,
  `relationship` tinyint(4) NOT NULL,
  `event` tinyint(4) NOT NULL,
  UNIQUE KEY `email_setting_user_id_idx` (`user_id`,`relationship`,`event`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Dumping data for table `email_setting`
--

LOCK TABLES `email_setting` WRITE;
/*!40000 ALTER TABLE `email_setting` DISABLE KEYS */;
INSERT INTO `email_setting` VALUES (1,0,0),(1,0,1),(1,0,2),(1,0,3),(1,0,4),(1,0,5),(1,0,6),(1,0,7),(1,0,9),(1,0,50),(1,1,0),(1,1,1),(1,1,2),(1,1,3),(1,1,4),(1,1,5),(1,1,6),(1,1,7),(1,1,9),(1,1,50),(1,2,0),(1,2,1),(1,2,2),(1,2,3),(1,2,4),(1,2,5),(1,2,6),(1,2,7),(1,2,8),(1,2,9),(1,2,50),(1,3,0),(1,3,1),(1,3,2),(1,3,3),(1,3,4),(1,3,5),(1,3,6),(1,3,7),(1,3,9),(1,3,50),(1,4,0),(1,4,1),(1,4,2),(1,4,3),(1,4,4),(1,4,5),(1,4,6),(1,4,7),(1,4,9),(1,4,50),(1,5,0),(1,5,1),(1,5,2),(1,5,3),(1,5,4),(1,5,5),(1,5,6),(1,5,7),(1,5,9),(1,5,50),(1,100,100),(1,100,101),(2,0,0),(2,0,1),(2,0,2),(2,0,3),(2,0,4),(2,0,5),(2,0,6),(2,0,7),(2,0,9),(2,0,50),(2,1,0),(2,1,1),(2,1,2),(2,1,3),(2,1,4),(2,1,5),(2,1,6),(2,1,7),(2,1,9),(2,1,50),(2,2,0),(2,2,1),(2,2,2),(2,2,3),(2,2,4),(2,2,5),(2,2,6),(2,2,7),(2,2,8),(2,2,9),(2,2,50),(2,3,0),(2,3,1),(2,3,2),(2,3,3),(2,3,4),(2,3,5),(2,3,6),(2,3,7),(2,3,9),(2,3,50),(2,4,0),(2,4,1),(2,4,2),(2,4,3),(2,4,4),(2,4,5),(2,4,6),(2,4,7),(2,4,9),(2,4,50),(2,5,0),(2,5,1),(2,5,2),(2,5,3),(2,5,4),(2,5,5),(2,5,6),(2,5,7),(2,5,9),(2,5,50),(2,100,100),(2,100,101),(3,0,0),(3,0,1),(3,0,2),(3,0,3),(3,0,4),(3,0,5),(3,0,6),(3,0,7),(3,0,9),(3,0,50),(3,1,0),(3,1,1),(3,1,2),(3,1,3),(3,1,4),(3,1,5),(3,1,6),(3,1,7),(3,1,9),(3,1,50),(3,2,0),(3,2,1),(3,2,2),(3,2,3),(3,2,4),(3,2,5),(3,2,6),(3,2,7),(3,2,8),(3,2,9),(3,2,50),(3,3,0),(3,3,1),(3,3,2),(3,3,3),(3,3,4),(3,3,5),(3,3,6),(3,3,7),(3,3,9),(3,3,50),(3,4,0),(3,4,1),(3,4,2),(3,4,3),(3,4,4),(3,4,5),(3,4,6),(3,4,7),(3,4,9),(3,4,50),(3,5,0),(3,5,1),(3,5,2),(3,5,3),(3,5,4),(3,5,5),(3,5,6),(3,5,7),(3,5,9),(3,5,50),(3,100,100),(3,100,101),(4,0,0),(4,0,1),(4,0,2),(4,0,3),(4,0,4),(4,0,5),(4,0,6),(4,0,7),(4,0,9),(4,0,50),(4,1,0),(4,1,1),(4,1,2),(4,1,3),(4,1,4),(4,1,5),(4,1,6),(4,1,7),(4,1,9),(4,1,50),(4,2,0),(4,2,1),(4,2,2),(4,2,3),(4,2,4),(4,2,5),(4,2,6),(4,2,7),(4,2,8),(4,2,9),(4,2,50),(4,3,0),(4,3,1),(4,3,2),(4,3,3),(4,3,4),(4,3,5),(4,3,6),(4,3,7),(4,3,9),(4,3,50),(4,4,0),(4,4,1),(4,4,2),(4,4,3),(4,4,4),(4,4,5),(4,4,6),(4,4,7),(4,4,9),(4,4,50),(4,5,0),(4,5,1),(4,5,2),(4,5,3),(4,5,4),(4,5,5),(4,5,6),(4,5,7),(4,5,9),(4,5,50),(4,100,100),(4,100,101),(5,0,0),(5,0,1),(5,0,2),(5,0,3),(5,0,4),(5,0,5),(5,0,6),(5,0,7),(5,0,9),(5,0,50),(5,1,0),(5,1,1),(5,1,2),(5,1,3),(5,1,4),(5,1,5),(5,1,6),(5,1,7),(5,1,9),(5,1,50),(5,2,0),(5,2,1),(5,2,2),(5,2,3),(5,2,4),(5,2,5),(5,2,6),(5,2,7),(5,2,8),(5,2,9),(5,2,50),(5,3,0),(5,3,1),(5,3,2),(5,3,3),(5,3,4),(5,3,5),(5,3,6),(5,3,7),(5,3,9),(5,3,50),(5,4,0),(5,4,1),(5,4,2),(5,4,3),(5,4,4),(5,4,5),(5,4,6),(5,4,7),(5,4,9),(5,4,50),(5,5,0),(5,5,1),(5,5,2),(5,5,3),(5,5,4),(5,5,5),(5,5,6),(5,5,7),(5,5,9),(5,5,50),(5,100,100),(5,100,101),(6,0,0),(6,0,1),(6,0,2),(6,0,3),(6,0,4),(6,0,5),(6,0,6),(6,0,7),(6,0,9),(6,0,50),(6,1,0),(6,1,1),(6,1,2),(6,1,3),(6,1,4),(6,1,5),(6,1,6),(6,1,7),(6,1,9),(6,1,50),(6,2,0),(6,2,1),(6,2,2),(6,2,3),(6,2,4),(6,2,5),(6,2,6),(6,2,7),(6,2,8),(6,2,9),(6,2,50),(6,3,0),(6,3,1),(6,3,2),(6,3,3),(6,3,4),(6,3,5),(6,3,6),(6,3,7),(6,3,9),(6,3,50),(6,4,0),(6,4,1),(6,4,2),(6,4,3),(6,4,4),(6,4,5),(6,4,6),(6,4,7),(6,4,9),(6,4,50),(6,5,0),(6,5,1),(6,5,2),(6,5,3),(6,5,4),(6,5,5),(6,5,6),(6,5,7),(6,5,9),(6,5,50),(6,100,100),(6,100,101),(7,0,0),(7,0,1),(7,0,2),(7,0,3),(7,0,4),(7,0,5),(7,0,6),(7,0,7),(7,0,9),(7,0,50),(7,1,0),(7,1,1),(7,1,2),(7,1,3),(7,1,4),(7,1,5),(7,1,6),(7,1,7),(7,1,9),(7,1,50),(7,2,0),(7,2,1),(7,2,2),(7,2,3),(7,2,4),(7,2,5),(7,2,6),(7,2,7),(7,2,8),(7,2,9),(7,2,50),(7,3,0),(7,3,1),(7,3,2),(7,3,3),(7,3,4),(7,3,5),(7,3,6),(7,3,7),(7,3,9),(7,3,50),(7,4,0),(7,4,1),(7,4,2),(7,4,3),(7,4,4),(7,4,5),(7,4,6),(7,4,7),(7,4,9),(7,4,50),(7,5,0),(7,5,1),(7,5,2),(7,5,3),(7,5,4),(7,5,5),(7,5,6),(7,5,7),(7,5,9),(7,5,50),(7,100,100),(7,100,101),(8,0,0),(8,0,1),(8,0,2),(8,0,3),(8,0,4),(8,0,5),(8,0,6),(8,0,7),(8,0,9),(8,0,50),(8,1,0),(8,1,1),(8,1,2),(8,1,3),(8,1,4),(8,1,5),(8,1,6),(8,1,7),(8,1,9),(8,1,50),(8,2,0),(8,2,1),(8,2,2),(8,2,3),(8,2,4),(8,2,5),(8,2,6),(8,2,7),(8,2,8),(8,2,9),(8,2,50),(8,3,0),(8,3,1),(8,3,2),(8,3,3),(8,3,4),(8,3,5),(8,3,6),(8,3,7),(8,3,9),(8,3,50),(8,4,0),(8,4,1),(8,4,2),(8,4,3),(8,4,4),(8,4,5),(8,4,6),(8,4,7),(8,4,9),(8,4,50),(8,5,0),(8,5,1),(8,5,2),(8,5,3),(8,5,4),(8,5,5),(8,5,6),(8,5,7),(8,5,9),(8,5,50),(8,100,100),(8,100,101);
/*!40000 ALTER TABLE `email_setting` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `fielddefs`
--

DROP TABLE IF EXISTS `fielddefs`;
CREATE TABLE `fielddefs` (
  `id` mediumint(9) NOT NULL auto_increment,
  `name` varchar(64) NOT NULL,
  `type` smallint(6) NOT NULL default '0',
  `custom` tinyint(4) NOT NULL default '0',
  `description` mediumtext NOT NULL,
  `mailhead` tinyint(4) NOT NULL default '0',
  `sortkey` smallint(6) NOT NULL,
  `obsolete` tinyint(4) NOT NULL default '0',
  `enter_bug` tinyint(4) NOT NULL default '0',
  PRIMARY KEY  (`id`),
  UNIQUE KEY `fielddefs_name_idx` (`name`),
  KEY `fielddefs_sortkey_idx` (`sortkey`)
) ENGINE=MyISAM AUTO_INCREMENT=54 DEFAULT CHARSET=utf8;

--
-- Dumping data for table `fielddefs`
--

LOCK TABLES `fielddefs` WRITE;
/*!40000 ALTER TABLE `fielddefs` DISABLE KEYS */;
INSERT INTO `fielddefs` VALUES (1,'bug_id',0,0,'Bug #',1,100,0,0),(2,'short_desc',0,0,'Summary',1,200,0,0),(3,'classification',0,0,'Classification',1,300,0,0),(4,'product',0,0,'Product',1,400,0,0),(5,'version',0,0,'Version',1,500,0,0),(6,'rep_platform',0,0,'Platform',1,600,0,0),(7,'bug_file_loc',0,0,'URL',1,700,0,0),(8,'op_sys',0,0,'OS/Version',1,800,0,0),(9,'bug_status',0,0,'Status',1,900,0,0),(10,'status_whiteboard',0,0,'Status Whiteboard',1,1000,0,0),(11,'keywords',0,0,'Keywords',1,1100,0,0),(12,'resolution',0,0,'Resolution',0,1200,0,0),(13,'bug_severity',0,0,'Severity',1,1300,0,0),(14,'priority',0,0,'Priority',1,1400,0,0),(15,'component',0,0,'Component',1,1500,0,0),(16,'assigned_to',0,0,'AssignedTo',1,1600,0,0),(17,'reporter',0,0,'ReportedBy',1,1700,0,0),(18,'votes',0,0,'Votes',0,1800,0,0),(19,'qa_contact',0,0,'QAContact',1,1900,0,0),(20,'cc',0,0,'CC',1,2000,0,0),(21,'dependson',0,0,'Depends on',1,2100,0,0),(22,'blocked',0,0,'Blocks',1,2200,0,0),(23,'attachments.description',0,0,'Attachment description',0,2300,0,0),(24,'attachments.filename',0,0,'Attachment filename',0,2400,0,0),(25,'attachments.mimetype',0,0,'Attachment mime type',0,2500,0,0),(26,'attachments.ispatch',0,0,'Attachment is patch',0,2600,0,0),(27,'attachments.isobsolete',0,0,'Attachment is obsolete',0,2700,0,0),(28,'attachments.isprivate',0,0,'Attachment is private',0,2800,0,0),(29,'attachments.submitter',0,0,'Attachment creator',0,2900,0,0),(30,'target_milestone',0,0,'Target Milestone',0,3000,0,0),(31,'creation_ts',0,0,'Creation date',1,3100,0,0),(32,'delta_ts',0,0,'Last changed date',1,3200,0,0),(33,'longdesc',0,0,'Comment',0,3300,0,0),(34,'longdescs.isprivate',0,0,'Comment is private',0,3400,0,0),(35,'alias',0,0,'Alias',0,3500,0,0),(36,'everconfirmed',0,0,'Ever Confirmed',0,3600,0,0),(37,'reporter_accessible',0,0,'Reporter Accessible',0,3700,0,0),(38,'cclist_accessible',0,0,'CC Accessible',0,3800,0,0),(39,'bug_group',0,0,'Group',0,3900,0,0),(40,'estimated_time',0,0,'Estimated Hours',1,4000,0,0),(41,'remaining_time',0,0,'Remaining Hours',0,4100,0,0),(42,'deadline',0,0,'Deadline',1,4200,0,0),(43,'commenter',0,0,'Commenter',0,4300,0,0),(44,'flagtypes.name',0,0,'Flag',0,4400,0,0),(45,'requestees.login_name',0,0,'Flag Requestee',0,4500,0,0),(46,'setters.login_name',0,0,'Flag Setter',0,4600,0,0),(47,'work_time',0,0,'Hours Worked',0,4700,0,0),(48,'percentage_complete',0,0,'Percentage Complete',0,4800,0,0),(49,'content',0,0,'Content',0,4900,0,0),(50,'attach_data.thedata',0,0,'Attachment data',0,5000,0,0),(51,'attachments.isurl',0,0,'Attachment is a URL',0,5100,0,0),(52,'owner_idle_time',0,0,'Time Since Assignee Touched',0,5200,0,0),(53,'days_elapsed',0,0,'Days since bug changed',0,5300,0,0);
/*!40000 ALTER TABLE `fielddefs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `flagexclusions`
--

DROP TABLE IF EXISTS `flagexclusions`;
CREATE TABLE `flagexclusions` (
  `type_id` smallint(6) NOT NULL,
  `product_id` smallint(6) default NULL,
  `component_id` smallint(6) default NULL,
  KEY `flagexclusions_type_id_idx` (`type_id`,`product_id`,`component_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Dumping data for table `flagexclusions`
--

LOCK TABLES `flagexclusions` WRITE;
/*!40000 ALTER TABLE `flagexclusions` DISABLE KEYS */;
/*!40000 ALTER TABLE `flagexclusions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `flaginclusions`
--

DROP TABLE IF EXISTS `flaginclusions`;
CREATE TABLE `flaginclusions` (
  `type_id` smallint(6) NOT NULL,
  `product_id` smallint(6) default NULL,
  `component_id` smallint(6) default NULL,
  KEY `flaginclusions_type_id_idx` (`type_id`,`product_id`,`component_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Dumping data for table `flaginclusions`
--

LOCK TABLES `flaginclusions` WRITE;
/*!40000 ALTER TABLE `flaginclusions` DISABLE KEYS */;
/*!40000 ALTER TABLE `flaginclusions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `flags`
--

DROP TABLE IF EXISTS `flags`;
CREATE TABLE `flags` (
  `id` mediumint(9) NOT NULL auto_increment,
  `type_id` smallint(6) NOT NULL,
  `status` char(1) NOT NULL,
  `bug_id` mediumint(9) NOT NULL,
  `attach_id` mediumint(9) default NULL,
  `creation_date` datetime NOT NULL,
  `modification_date` datetime default NULL,
  `setter_id` mediumint(9) default NULL,
  `requestee_id` mediumint(9) default NULL,
  PRIMARY KEY  (`id`),
  KEY `flags_bug_id_idx` (`bug_id`,`attach_id`),
  KEY `flags_setter_id_idx` (`setter_id`),
  KEY `flags_requestee_id_idx` (`requestee_id`),
  KEY `flags_type_id_idx` (`type_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Dumping data for table `flags`
--

LOCK TABLES `flags` WRITE;
/*!40000 ALTER TABLE `flags` DISABLE KEYS */;
/*!40000 ALTER TABLE `flags` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `flagtypes`
--

DROP TABLE IF EXISTS `flagtypes`;
CREATE TABLE `flagtypes` (
  `id` smallint(6) NOT NULL auto_increment,
  `name` varchar(50) NOT NULL,
  `description` text,
  `cc_list` varchar(200) default NULL,
  `target_type` char(1) NOT NULL default 'b',
  `is_active` tinyint(4) NOT NULL default '1',
  `is_requestable` tinyint(4) NOT NULL default '0',
  `is_requesteeble` tinyint(4) NOT NULL default '0',
  `is_multiplicable` tinyint(4) NOT NULL default '0',
  `sortkey` smallint(6) NOT NULL default '0',
  `grant_group_id` mediumint(9) default NULL,
  `request_group_id` mediumint(9) default NULL,
  PRIMARY KEY  (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Dumping data for table `flagtypes`
--

LOCK TABLES `flagtypes` WRITE;
/*!40000 ALTER TABLE `flagtypes` DISABLE KEYS */;
/*!40000 ALTER TABLE `flagtypes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `group_control_map`
--

DROP TABLE IF EXISTS `group_control_map`;
CREATE TABLE `group_control_map` (
  `group_id` mediumint(9) NOT NULL,
  `product_id` mediumint(9) NOT NULL,
  `entry` tinyint(4) NOT NULL,
  `membercontrol` tinyint(4) NOT NULL,
  `othercontrol` tinyint(4) NOT NULL,
  `canedit` tinyint(4) NOT NULL,
  `editcomponents` tinyint(4) NOT NULL default '0',
  `editbugs` tinyint(4) NOT NULL default '0',
  `canconfirm` tinyint(4) NOT NULL default '0',
  UNIQUE KEY `group_control_map_product_id_idx` (`product_id`,`group_id`),
  KEY `group_control_map_group_id_idx` (`group_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Dumping data for table `group_control_map`
--

LOCK TABLES `group_control_map` WRITE;
/*!40000 ALTER TABLE `group_control_map` DISABLE KEYS */;
INSERT INTO `group_control_map` VALUES (15,3,1,3,3,0,0,0,0),(16,2,1,3,3,0,0,0,0);
/*!40000 ALTER TABLE `group_control_map` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `group_group_map`
--

DROP TABLE IF EXISTS `group_group_map`;
CREATE TABLE `group_group_map` (
  `member_id` mediumint(9) NOT NULL,
  `grantor_id` mediumint(9) NOT NULL,
  `grant_type` tinyint(4) NOT NULL default '0',
  UNIQUE KEY `group_group_map_member_id_idx` (`member_id`,`grantor_id`,`grant_type`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Dumping data for table `group_group_map`
--

LOCK TABLES `group_group_map` WRITE;
/*!40000 ALTER TABLE `group_group_map` DISABLE KEYS */;
INSERT INTO `group_group_map` VALUES (1,15,0),(1,16,0),(2,2,0),(2,2,1),(2,2,2),(2,3,0),(2,3,1),(2,3,2),(2,4,0),(2,4,1),(2,4,2),(2,5,0),(2,5,1),(2,5,2),(2,6,0),(2,6,1),(2,6,2),(2,7,0),(2,7,1),(2,7,2),(2,8,0),(2,8,1),(2,8,2),(2,9,0),(2,9,1),(2,9,2),(2,10,0),(2,10,1),(2,10,2),(2,11,0),(2,11,1),(2,11,2),(2,12,0),(2,12,1),(2,12,2),(2,13,0),(2,13,1),(2,13,2),(2,14,0),(2,14,1),(2,14,2),(2,15,0),(2,15,1),(2,15,2),(2,16,0),(2,16,1),(2,16,2),(12,14,0),(13,11,0),(16,15,0);
/*!40000 ALTER TABLE `group_group_map` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `groups`
--

DROP TABLE IF EXISTS `groups`;
CREATE TABLE `groups` (
  `id` mediumint(9) NOT NULL auto_increment,
  `name` varchar(255) NOT NULL,
  `description` text NOT NULL,
  `isbuggroup` tinyint(4) NOT NULL,
  `userregexp` tinytext NOT NULL,
  `isactive` tinyint(4) NOT NULL default '1',
  PRIMARY KEY  (`id`),
  UNIQUE KEY `groups_name_idx` (`name`)
) ENGINE=MyISAM AUTO_INCREMENT=17 DEFAULT CHARSET=utf8;

--
-- Dumping data for table `groups`
--

LOCK TABLES `groups` WRITE;
/*!40000 ALTER TABLE `groups` DISABLE KEYS */;
INSERT INTO `groups` VALUES (1,'Testers','Can read and write all test plans, runs, and cases.',0,'',1),(2,'admin','Administrators',0,'',1),(3,'tweakparams','Can change Parameters',0,'',1),(4,'editusers','Can edit or disable users',0,'',1),(5,'creategroups','Can create and destroy groups',0,'',1),(6,'editclassifications','Can create, destroy, and edit classifications',0,'',1),(7,'editcomponents','Can create, destroy, and edit components',0,'',1),(8,'editkeywords','Can create, destroy, and edit keywords',0,'',1),(9,'editbugs','Can edit all bug fields',0,'.*',1),(10,'canconfirm','Can confirm a bug or mark it a duplicate',0,'',1),(11,'bz_canusewhines','User can configure whine reports for self',0,'',1),(12,'bz_sudoers','Can perform actions as other users',0,'',1),(13,'bz_canusewhineatothers','Can configure whine reports for other users',0,'',1),(14,'bz_sudo_protect','Can not be impersonated by other users',0,'',1),(15,'partners','Full access to certain products',1,'',1),(16,'private','access restricted to insiders',1,'',1);
/*!40000 ALTER TABLE `groups` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `keyworddefs`
--

DROP TABLE IF EXISTS `keyworddefs`;
CREATE TABLE `keyworddefs` (
  `id` smallint(6) NOT NULL auto_increment,
  `name` varchar(64) NOT NULL,
  `description` mediumtext,
  PRIMARY KEY  (`id`),
  UNIQUE KEY `keyworddefs_name_idx` (`name`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Dumping data for table `keyworddefs`
--

LOCK TABLES `keyworddefs` WRITE;
/*!40000 ALTER TABLE `keyworddefs` DISABLE KEYS */;
/*!40000 ALTER TABLE `keyworddefs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `keywords`
--

DROP TABLE IF EXISTS `keywords`;
CREATE TABLE `keywords` (
  `bug_id` mediumint(9) NOT NULL,
  `keywordid` smallint(6) NOT NULL,
  UNIQUE KEY `keywords_bug_id_idx` (`bug_id`,`keywordid`),
  KEY `keywords_keywordid_idx` (`keywordid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Dumping data for table `keywords`
--

LOCK TABLES `keywords` WRITE;
/*!40000 ALTER TABLE `keywords` DISABLE KEYS */;
/*!40000 ALTER TABLE `keywords` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `logincookies`
--

DROP TABLE IF EXISTS `logincookies`;
CREATE TABLE `logincookies` (
  `cookie` varchar(16) NOT NULL,
  `userid` mediumint(9) NOT NULL,
  `ipaddr` varchar(40) NOT NULL,
  `lastused` datetime NOT NULL,
  PRIMARY KEY  (`cookie`),
  KEY `logincookies_lastused_idx` (`lastused`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Dumping data for table `logincookies`
--

LOCK TABLES `logincookies` WRITE;
/*!40000 ALTER TABLE `logincookies` DISABLE KEYS */;
INSERT INTO `logincookies` VALUES ('3tPULLcQNr',7,'127.0.0.2','2008-05-02 14:38:10'),('BmPBa5fs1k',1,'127.0.0.2','2008-04-04 13:49:18'),('L4lpjuURN7',1,'127.0.0.2','2008-05-02 14:40:55'),('JmHB7RbSWu',2,'127.0.0.2','2008-05-02 14:48:28'),('ZFOn80C0Uj',7,'127.0.0.2','2008-05-02 14:48:49'),('BU0lAg8f9T',1,'127.0.0.2','2008-05-02 14:49:38'),('oAm04nRjcU',4,'127.0.0.2','2008-05-02 15:10:21'),('EaPwRDwhtX',7,'127.0.0.2','2008-05-02 15:11:08'),('wVOWqC5SO6',2,'127.0.0.2','2008-05-02 15:11:46'),('I3s7TpHOnX',1,'127.0.0.2','2008-05-02 15:12:28'),('64utKP1xis',2,'127.0.0.2','2008-05-02 15:13:33'),('nbjNtSjYJh',1,'127.0.0.2','2008-05-02 15:14:38'),('VlSC1SFanR',7,'127.0.0.2','2008-05-02 15:16:46'),('NBH46wH8Pw',2,'127.0.0.2','2008-05-02 15:17:29'),('FjvSz46JsP',7,'127.0.0.2','2008-05-02 15:20:26'),('5v2oehtH1p',3,'127.0.0.2','2008-05-15 14:50:32');
/*!40000 ALTER TABLE `logincookies` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `longdescs`
--

DROP TABLE IF EXISTS `longdescs`;
CREATE TABLE `longdescs` (
  `comment_id` mediumint(9) NOT NULL auto_increment,
  `bug_id` mediumint(9) NOT NULL,
  `who` mediumint(9) NOT NULL,
  `bug_when` datetime NOT NULL,
  `work_time` decimal(5,2) NOT NULL default '0.00',
  `thetext` mediumtext NOT NULL,
  `isprivate` tinyint(4) NOT NULL default '0',
  `already_wrapped` tinyint(4) NOT NULL default '0',
  `type` smallint(6) NOT NULL default '0',
  `extra_data` varchar(255) default NULL,
  PRIMARY KEY  (`comment_id`),
  KEY `longdescs_bug_id_idx` (`bug_id`),
  KEY `longdescs_who_idx` (`who`,`bug_id`),
  KEY `longdescs_bug_when_idx` (`bug_when`),
  FULLTEXT KEY `longdescs_thetext_idx` (`thetext`)
) ENGINE=MyISAM AUTO_INCREMENT=7 DEFAULT CHARSET=utf8;

--
-- Dumping data for table `longdescs`
--

LOCK TABLES `longdescs` WRITE;
/*!40000 ALTER TABLE `longdescs` DISABLE KEYS */;
INSERT INTO `longdescs` VALUES (1,1,1,'2008-03-27 15:48:39','0.00','PUBLIC VISIBLE BUG - basic',0,0,0,NULL),(2,2,1,'2008-05-01 17:24:10','0.00','STATUS: IDLE\nBUILD: PUBLIC ACTIVE BUILD 1\nENVIRONMENT: PUBLIC ACTIVE ENVIRONMENT\nNOTES: \nSTEPS TO REPRODUCE: \n\nPublic bug logged from test case 5 in run 1',0,0,0,NULL),(3,3,1,'2008-05-02 15:10:00','0.00','Created an attachment (id=1)\nLOREM\n\nTHIS BUG IS PUBLIC',0,0,0,NULL),(4,4,2,'2008-05-02 15:19:36','0.00','PARTNER BUG',0,0,0,NULL),(5,5,7,'2008-05-02 15:21:06','0.00','PRIVATE BUG',0,0,0,NULL),(6,6,3,'2008-05-02 15:27:32','0.00','STATUS: IDLE\nBUILD: PRIVATE INACTIVE BUILD\nENVIRONMENT: PRIVATE INACTIVE ENVIRONMENT\nNOTES: \nSTEPS TO REPRODUCE: Logged from run 3',0,0,0,NULL);
/*!40000 ALTER TABLE `longdescs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `milestones`
--

DROP TABLE IF EXISTS `milestones`;
CREATE TABLE `milestones` (
  `id` mediumint(9) NOT NULL auto_increment,
  `product_id` smallint(6) NOT NULL,
  `value` varchar(20) NOT NULL,
  `sortkey` smallint(6) NOT NULL default '0',
  `disallownew` tinyint(4) NOT NULL default '0',
  PRIMARY KEY  (`id`),
  UNIQUE KEY `milestones_product_id_idx` (`product_id`,`value`)
) ENGINE=MyISAM AUTO_INCREMENT=7 DEFAULT CHARSET=utf8;

--
-- Dumping data for table `milestones`
--

LOCK TABLES `milestones` WRITE;
/*!40000 ALTER TABLE `milestones` DISABLE KEYS */;
INSERT INTO `milestones` VALUES (1,1,'PUBLIC M1',0,0),(2,2,'PRIVATE M1',0,0),(3,3,'PARTNER M1',0,0),(4,3,'PARTNER M2',0,0),(5,1,'PUBLIC M2',0,0),(6,2,'PRIVATE M2',0,0);
/*!40000 ALTER TABLE `milestones` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `namedqueries`
--

DROP TABLE IF EXISTS `namedqueries`;
CREATE TABLE `namedqueries` (
  `id` mediumint(9) NOT NULL auto_increment,
  `userid` mediumint(9) NOT NULL,
  `name` varchar(64) NOT NULL,
  `query` mediumtext NOT NULL,
  `query_type` tinyint(4) NOT NULL,
  PRIMARY KEY  (`id`),
  UNIQUE KEY `namedqueries_userid_idx` (`userid`,`name`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Dumping data for table `namedqueries`
--

LOCK TABLES `namedqueries` WRITE;
/*!40000 ALTER TABLE `namedqueries` DISABLE KEYS */;
/*!40000 ALTER TABLE `namedqueries` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `namedqueries_link_in_footer`
--

DROP TABLE IF EXISTS `namedqueries_link_in_footer`;
CREATE TABLE `namedqueries_link_in_footer` (
  `namedquery_id` mediumint(9) NOT NULL,
  `user_id` mediumint(9) NOT NULL,
  UNIQUE KEY `namedqueries_link_in_footer_id_idx` (`namedquery_id`,`user_id`),
  KEY `namedqueries_link_in_footer_userid_idx` (`user_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Dumping data for table `namedqueries_link_in_footer`
--

LOCK TABLES `namedqueries_link_in_footer` WRITE;
/*!40000 ALTER TABLE `namedqueries_link_in_footer` DISABLE KEYS */;
/*!40000 ALTER TABLE `namedqueries_link_in_footer` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `namedquery_group_map`
--

DROP TABLE IF EXISTS `namedquery_group_map`;
CREATE TABLE `namedquery_group_map` (
  `namedquery_id` mediumint(9) NOT NULL,
  `group_id` mediumint(9) NOT NULL,
  UNIQUE KEY `namedquery_group_map_namedquery_id_idx` (`namedquery_id`),
  KEY `namedquery_group_map_group_id_idx` (`group_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Dumping data for table `namedquery_group_map`
--

LOCK TABLES `namedquery_group_map` WRITE;
/*!40000 ALTER TABLE `namedquery_group_map` DISABLE KEYS */;
/*!40000 ALTER TABLE `namedquery_group_map` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `op_sys`
--

DROP TABLE IF EXISTS `op_sys`;
CREATE TABLE `op_sys` (
  `id` smallint(6) NOT NULL auto_increment,
  `value` varchar(64) NOT NULL,
  `sortkey` smallint(6) NOT NULL default '0',
  `isactive` tinyint(4) NOT NULL default '1',
  PRIMARY KEY  (`id`),
  UNIQUE KEY `op_sys_value_idx` (`value`),
  KEY `op_sys_sortkey_idx` (`sortkey`,`value`)
) ENGINE=MyISAM AUTO_INCREMENT=6 DEFAULT CHARSET=utf8;

--
-- Dumping data for table `op_sys`
--

LOCK TABLES `op_sys` WRITE;
/*!40000 ALTER TABLE `op_sys` DISABLE KEYS */;
INSERT INTO `op_sys` VALUES (1,'All',100,1),(2,'Windows',200,1),(3,'Mac OS',300,1),(4,'Linux',400,1),(5,'Other',500,1);
/*!40000 ALTER TABLE `op_sys` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `priority`
--

DROP TABLE IF EXISTS `priority`;
CREATE TABLE `priority` (
  `id` smallint(6) NOT NULL auto_increment,
  `value` varchar(64) NOT NULL,
  `sortkey` smallint(6) NOT NULL default '0',
  `isactive` tinyint(4) NOT NULL default '1',
  PRIMARY KEY  (`id`),
  UNIQUE KEY `priority_value_idx` (`value`),
  KEY `priority_sortkey_idx` (`sortkey`,`value`)
) ENGINE=MyISAM AUTO_INCREMENT=6 DEFAULT CHARSET=utf8;

--
-- Dumping data for table `priority`
--

LOCK TABLES `priority` WRITE;
/*!40000 ALTER TABLE `priority` DISABLE KEYS */;
INSERT INTO `priority` VALUES (1,'P1',100,1),(2,'P2',200,1),(3,'P3',300,1),(4,'P4',400,1),(5,'P5',500,1);
/*!40000 ALTER TABLE `priority` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `products`
--

DROP TABLE IF EXISTS `products`;
CREATE TABLE `products` (
  `id` smallint(6) NOT NULL auto_increment,
  `name` varchar(64) NOT NULL,
  `classification_id` smallint(6) NOT NULL default '1',
  `description` mediumtext,
  `milestoneurl` tinytext NOT NULL,
  `disallownew` tinyint(4) NOT NULL default '0',
  `votesperuser` smallint(6) NOT NULL default '0',
  `maxvotesperbug` smallint(6) NOT NULL default '10000',
  `votestoconfirm` smallint(6) NOT NULL default '0',
  `defaultmilestone` varchar(20) NOT NULL default '---',
  PRIMARY KEY  (`id`),
  UNIQUE KEY `products_name_idx` (`name`)
) ENGINE=MyISAM AUTO_INCREMENT=4 DEFAULT CHARSET=utf8;

--
-- Dumping data for table `products`
--

LOCK TABLES `products` WRITE;
/*!40000 ALTER TABLE `products` DISABLE KEYS */;
INSERT INTO `products` VALUES (1,'PUBLIC PRODUCT ONE',1,'PUBLIC PRODUCT','',0,0,10000,0,'PUBLIC M1'),(2,'PRIVATE PRODUCT ONE',3,'PRIVATE PRODUCT','',0,0,10000,0,'PRIVATE M1'),(3,'PARTNER PRODUCT ONE',2,'PARTNER PRODUCT','',0,0,10000,0,'PARTNER M1');
/*!40000 ALTER TABLE `products` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `profile_setting`
--

DROP TABLE IF EXISTS `profile_setting`;
CREATE TABLE `profile_setting` (
  `user_id` mediumint(9) NOT NULL,
  `setting_name` varchar(32) NOT NULL,
  `setting_value` varchar(32) NOT NULL,
  UNIQUE KEY `profile_setting_value_unique_idx` (`user_id`,`setting_name`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Dumping data for table `profile_setting`
--

LOCK TABLES `profile_setting` WRITE;
/*!40000 ALTER TABLE `profile_setting` DISABLE KEYS */;
/*!40000 ALTER TABLE `profile_setting` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `profiles`
--

DROP TABLE IF EXISTS `profiles`;
CREATE TABLE `profiles` (
  `userid` mediumint(9) NOT NULL auto_increment,
  `login_name` varchar(255) NOT NULL,
  `cryptpassword` varchar(128) default NULL,
  `realname` varchar(255) NOT NULL default '',
  `disabledtext` mediumtext NOT NULL,
  `disable_mail` tinyint(4) NOT NULL default '0',
  `mybugslink` tinyint(4) NOT NULL default '1',
  `extern_id` varchar(64) default NULL,
  PRIMARY KEY  (`userid`),
  UNIQUE KEY `profiles_login_name_idx` (`login_name`)
) ENGINE=MyISAM AUTO_INCREMENT=9 DEFAULT CHARSET=utf8;

--
-- Dumping data for table `profiles`
--

LOCK TABLES `profiles` WRITE;
/*!40000 ALTER TABLE `profiles` DISABLE KEYS */;
INSERT INTO `profiles` VALUES (1,'admin@testopia.com','gaYVtWOEm1Uu6','Administrator','',0,1,NULL),(2,'partner@testopia.com','tXDoNaxzga5/g','partner','',0,1,NULL),(3,'tester@testopia.com','RxCZ93TxwnHFw','tester','',0,1,NULL),(4,'public@testopia.com','CDLQmFTbMGUI.','public','',0,1,NULL),(5,'public_qa@testopia.com','j.kGVdj9j1Nes','public_qa','',0,1,NULL),(6,'partner_qa@testopia.com','cpDcIQV.8fcEI','partner_qa','',0,1,NULL),(7,'private@testopia.com','rchARuyeCjm8o','private','',0,1,NULL),(8,'private_qa@testopia.com','nU.nkYvKgijzA','private_qa','',0,1,NULL);
/*!40000 ALTER TABLE `profiles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `profiles_activity`
--

DROP TABLE IF EXISTS `profiles_activity`;
CREATE TABLE `profiles_activity` (
  `userid` mediumint(9) NOT NULL,
  `who` mediumint(9) NOT NULL,
  `profiles_when` datetime NOT NULL,
  `fieldid` mediumint(9) NOT NULL,
  `oldvalue` tinytext,
  `newvalue` tinytext,
  KEY `profiles_activity_userid_idx` (`userid`),
  KEY `profiles_activity_profiles_when_idx` (`profiles_when`),
  KEY `profiles_activity_fieldid_idx` (`fieldid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Dumping data for table `profiles_activity`
--

LOCK TABLES `profiles_activity` WRITE;
/*!40000 ALTER TABLE `profiles_activity` DISABLE KEYS */;
INSERT INTO `profiles_activity` VALUES (1,1,'2008-03-17 15:53:06',31,NULL,'2008-03-17 15:53:06'),(2,1,'2008-03-17 15:56:26',31,NULL,'2008-03-17 15:56:26'),(3,1,'2008-03-17 15:56:59',31,NULL,'2008-03-17 15:56:59'),(3,1,'2008-03-17 15:57:09',39,'','Testers'),(4,1,'2008-03-17 15:57:45',31,NULL,'2008-03-17 15:57:45'),(5,1,'2008-03-17 16:05:26',31,NULL,'2008-03-17 16:05:26'),(6,1,'2008-03-17 16:17:42',31,NULL,'2008-03-17 16:17:42'),(7,1,'2008-03-17 16:18:30',31,NULL,'2008-03-17 16:18:30'),(7,1,'2008-03-17 16:18:40',39,'','Testers'),(8,1,'2008-03-17 16:19:08',31,NULL,'2008-03-17 16:19:08'),(1,1,'2008-03-17 16:49:15',39,'','Testers'),(2,1,'2008-05-02 14:43:11',39,'','partners'),(6,1,'2008-05-02 14:43:40',39,'','partners'),(7,1,'2008-05-02 14:44:29',39,'Testers','private'),(8,1,'2008-05-02 14:44:49',39,'','private');
/*!40000 ALTER TABLE `profiles_activity` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `quips`
--

DROP TABLE IF EXISTS `quips`;
CREATE TABLE `quips` (
  `quipid` mediumint(9) NOT NULL auto_increment,
  `userid` mediumint(9) default NULL,
  `quip` text NOT NULL,
  `approved` tinyint(4) NOT NULL default '1',
  PRIMARY KEY  (`quipid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Dumping data for table `quips`
--

LOCK TABLES `quips` WRITE;
/*!40000 ALTER TABLE `quips` DISABLE KEYS */;
/*!40000 ALTER TABLE `quips` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `rep_platform`
--

DROP TABLE IF EXISTS `rep_platform`;
CREATE TABLE `rep_platform` (
  `id` smallint(6) NOT NULL auto_increment,
  `value` varchar(64) NOT NULL,
  `sortkey` smallint(6) NOT NULL default '0',
  `isactive` tinyint(4) NOT NULL default '1',
  PRIMARY KEY  (`id`),
  UNIQUE KEY `rep_platform_value_idx` (`value`),
  KEY `rep_platform_sortkey_idx` (`sortkey`,`value`)
) ENGINE=MyISAM AUTO_INCREMENT=5 DEFAULT CHARSET=utf8;

--
-- Dumping data for table `rep_platform`
--

LOCK TABLES `rep_platform` WRITE;
/*!40000 ALTER TABLE `rep_platform` DISABLE KEYS */;
INSERT INTO `rep_platform` VALUES (1,'All',100,1),(2,'PC',200,1),(3,'Macintosh',300,1),(4,'Other',400,1);
/*!40000 ALTER TABLE `rep_platform` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `resolution`
--

DROP TABLE IF EXISTS `resolution`;
CREATE TABLE `resolution` (
  `id` smallint(6) NOT NULL auto_increment,
  `value` varchar(64) NOT NULL,
  `sortkey` smallint(6) NOT NULL default '0',
  `isactive` tinyint(4) NOT NULL default '1',
  PRIMARY KEY  (`id`),
  UNIQUE KEY `resolution_value_idx` (`value`),
  KEY `resolution_sortkey_idx` (`sortkey`,`value`)
) ENGINE=MyISAM AUTO_INCREMENT=8 DEFAULT CHARSET=utf8;

--
-- Dumping data for table `resolution`
--

LOCK TABLES `resolution` WRITE;
/*!40000 ALTER TABLE `resolution` DISABLE KEYS */;
INSERT INTO `resolution` VALUES (1,'',100,1),(2,'FIXED',200,1),(3,'INVALID',300,1),(4,'WONTFIX',400,1),(5,'DUPLICATE',500,1),(6,'WORKSFORME',600,1),(7,'MOVED',700,1);
/*!40000 ALTER TABLE `resolution` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `series`
--

DROP TABLE IF EXISTS `series`;
CREATE TABLE `series` (
  `series_id` mediumint(9) NOT NULL auto_increment,
  `creator` mediumint(9) default NULL,
  `category` smallint(6) NOT NULL,
  `subcategory` smallint(6) NOT NULL,
  `name` varchar(64) NOT NULL,
  `frequency` smallint(6) NOT NULL,
  `last_viewed` datetime default NULL,
  `query` mediumtext NOT NULL,
  `is_public` tinyint(4) NOT NULL default '0',
  PRIMARY KEY  (`series_id`),
  UNIQUE KEY `series_creator_idx` (`creator`,`category`,`subcategory`,`name`)
) ENGINE=MyISAM AUTO_INCREMENT=7 DEFAULT CHARSET=utf8;

--
-- Dumping data for table `series`
--

LOCK TABLES `series` WRITE;
/*!40000 ALTER TABLE `series` DISABLE KEYS */;
INSERT INTO `series` VALUES (1,1,1,2,'All Open',1,NULL,'field0-0-0=resolution&type0-0-0=notregexp&value0-0-0=.&product=PUBLIC%20PRODUCT%20ONE&component=PUBLIC%20ONE%20COMP%202',1),(2,1,1,2,'All Closed',1,NULL,'field0-0-0=resolution&type0-0-0=regexp&value0-0-0=.&product=PUBLIC%20PRODUCT%20ONE&component=PUBLIC%20ONE%20COMP%202',1),(3,1,3,4,'All Open',1,NULL,'field0-0-0=resolution&type0-0-0=notregexp&value0-0-0=.&product=PRIVATE%20ONE&component=PRIVATE%20ONE%20COMP%201',1),(4,1,3,4,'All Closed',1,NULL,'field0-0-0=resolution&type0-0-0=regexp&value0-0-0=.&product=PRIVATE%20ONE&component=PRIVATE%20ONE%20COMP%201',1),(5,1,5,6,'All Open',1,NULL,'field0-0-0=resolution&type0-0-0=notregexp&value0-0-0=.&product=PARTNER%20ONE&component=PARTNER%20ONE%20COMP%201',1),(6,1,5,6,'All Closed',1,NULL,'field0-0-0=resolution&type0-0-0=regexp&value0-0-0=.&product=PARTNER%20ONE&component=PARTNER%20ONE%20COMP%201',1);
/*!40000 ALTER TABLE `series` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `series_categories`
--

DROP TABLE IF EXISTS `series_categories`;
CREATE TABLE `series_categories` (
  `id` smallint(6) NOT NULL auto_increment,
  `name` varchar(64) NOT NULL,
  PRIMARY KEY  (`id`),
  UNIQUE KEY `series_categories_name_idx` (`name`)
) ENGINE=MyISAM AUTO_INCREMENT=7 DEFAULT CHARSET=utf8;

--
-- Dumping data for table `series_categories`
--

LOCK TABLES `series_categories` WRITE;
/*!40000 ALTER TABLE `series_categories` DISABLE KEYS */;
INSERT INTO `series_categories` VALUES (1,'PUBLIC PRODUCT ONE'),(2,'PUBLIC ONE COMP 2'),(3,'PRIVATE ONE'),(4,'PRIVATE ONE COMP 1'),(5,'PARTNER ONE'),(6,'PARTNER ONE COMP 1');
/*!40000 ALTER TABLE `series_categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `series_data`
--

DROP TABLE IF EXISTS `series_data`;
CREATE TABLE `series_data` (
  `series_id` mediumint(9) NOT NULL,
  `series_date` datetime NOT NULL,
  `series_value` mediumint(9) NOT NULL,
  UNIQUE KEY `series_data_series_id_idx` (`series_id`,`series_date`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Dumping data for table `series_data`
--

LOCK TABLES `series_data` WRITE;
/*!40000 ALTER TABLE `series_data` DISABLE KEYS */;
/*!40000 ALTER TABLE `series_data` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `setting`
--

DROP TABLE IF EXISTS `setting`;
CREATE TABLE `setting` (
  `name` varchar(32) NOT NULL,
  `default_value` varchar(32) NOT NULL,
  `is_enabled` tinyint(4) NOT NULL default '1',
  `subclass` varchar(32) default NULL,
  PRIMARY KEY  (`name`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Dumping data for table `setting`
--

LOCK TABLES `setting` WRITE;
/*!40000 ALTER TABLE `setting` DISABLE KEYS */;
INSERT INTO `setting` VALUES ('skin','standard',1,'Skin'),('lang','en',1,NULL),('post_bug_submit_action','next_bug',1,NULL),('per_bug_queries','off',1,NULL),('zoom_textareas','on',1,NULL),('csv_colsepchar',',',1,NULL),('state_addselfcc','cc_unless_role',1,NULL),('comment_sort_order','oldest_to_newest',1,NULL),('display_quips','on',1,NULL);
/*!40000 ALTER TABLE `setting` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `setting_value`
--

DROP TABLE IF EXISTS `setting_value`;
CREATE TABLE `setting_value` (
  `name` varchar(32) NOT NULL,
  `value` varchar(32) NOT NULL,
  `sortindex` smallint(6) NOT NULL,
  UNIQUE KEY `setting_value_nv_unique_idx` (`name`,`value`),
  UNIQUE KEY `setting_value_ns_unique_idx` (`name`,`sortindex`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Dumping data for table `setting_value`
--

LOCK TABLES `setting_value` WRITE;
/*!40000 ALTER TABLE `setting_value` DISABLE KEYS */;
INSERT INTO `setting_value` VALUES ('lang','en',5),('post_bug_submit_action','next_bug',5),('post_bug_submit_action','same_bug',10),('post_bug_submit_action','nothing',15),('per_bug_queries','on',5),('per_bug_queries','off',10),('zoom_textareas','on',5),('zoom_textareas','off',10),('csv_colsepchar',',',5),('csv_colsepchar',';',10),('state_addselfcc','always',5),('state_addselfcc','never',10),('state_addselfcc','cc_unless_role',15),('comment_sort_order','oldest_to_newest',5),('comment_sort_order','newest_to_oldest',10),('comment_sort_order','newest_to_oldest_desc_first',15),('display_quips','on',5),('display_quips','off',10);
/*!40000 ALTER TABLE `setting_value` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `test_attachment_data`
--

DROP TABLE IF EXISTS `test_attachment_data`;
CREATE TABLE `test_attachment_data` (
  `attachment_id` int(11) NOT NULL,
  `contents` longblob,
  KEY `test_attachment_data_primary_idx` (`attachment_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Dumping data for table `test_attachment_data`
--

LOCK TABLES `test_attachment_data` WRITE;
/*!40000 ALTER TABLE `test_attachment_data` DISABLE KEYS */;
INSERT INTO `test_attachment_data` VALUES (1,'Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Nam pellentesque odio et elit. Nam lobortis sem suscipit sapien. Sed iaculis aliquam sapien. Maecenas ut lectus. Aenean fringilla massa et metus. Nam varius, sapien nec egestas feugiat, mi libero dignissim orci, id fermentum quam nisl quis risus. Phasellus libero justo, aliquet quis, pellentesque vitae, porttitor quis, orci. Maecenas sollicitudin. Donec bibendum, ante quis sodales fermentum, quam risus placerat pede, nec aliquam lorem odio sit amet nisi. Ut sem tellus, feugiat vitae, lobortis nec, dapibus at, est. Aenean cursus. Vivamus faucibus lectus eget felis. Nullam commodo tortor vitae turpis.\n\nSed mollis interdum risus. Pellentesque ante velit, facilisis vitae, fermentum eu, feugiat sit amet, dui. Suspendisse tempus ullamcorper nisl. Suspendisse ullamcorper, velit non luctus gravida, massa turpis ullamcorper eros, sed dictum risus neque ut augue. Vestibulum neque nulla, pretium fermentum, rutrum vehicula, pulvinar at, est. Quisque dignissim. Nullam placerat neque vel urna. Quisque cursus lacus rutrum tortor. Nunc ut elit. Vestibulum mi nunc, volutpat id, tempor ut, scelerisque vel, magna. Aenean nisl nulla, rutrum sit amet, sollicitudin sed, molestie eget, nisi. Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. In odio erat, bibendum eu, gravida nec, elementum sed, urna.\n\nAliquam ultricies viverra mi. Ut convallis urna quis urna. Sed sed tortor. Suspendisse quis tellus. Ut gravida. Ut facilisis lectus in purus. Sed at est non libero dignissim varius. Donec vestibulum odio ac felis. Duis interdum pellentesque nisl. Aenean leo. Curabitur lectus. Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Duis nisl ligula, elementum vitae, posuere eu, semper eget, augue. Maecenas metus nulla, ullamcorper id, malesuada sit amet, mattis nec, lacus. Nam tortor.\n\nNam sollicitudin, lacus sit amet aliquam tempus, nulla tellus tempus velit, eu sollicitudin dolor dui et velit. In ac sem. Mauris adipiscing enim in felis. Morbi porttitor laoreet sapien. Nam felis dolor, laoreet sed, iaculis eu, vulputate eu, nunc. Nullam egestas ligula. Fusce ut sapien. Aliquam erat volutpat. Proin tristique scelerisque sem. Nullam non erat.\n\nSed feugiat, lacus in elementum egestas, sapien nulla sodales leo, nec scelerisque diam eros eu arcu. Phasellus ut magna. Cras dignissim pellentesque tellus. Curabitur sapien. Suspendisse a risus lobortis quam consectetuer placerat. Aliquam ultricies pretium tortor. Aliquam erat volutpat. Mauris nunc. Etiam vitae diam. Aenean a felis. Donec posuere, lacus in lacinia commodo, ligula lectus rutrum nibh, non dapibus sapien enim eu mauris. Pellentesque arcu risus, condimentum id, dapibus in, blandit ut, pede. Nulla facilisi. Vestibulum elit quam, fringilla convallis, congue lacinia, dictum at, velit. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia Curae; Sed augue mauris, commodo vel, tincidunt hendrerit, consectetuer eu, eros. \n'),(2,'�PNG\r\n\Z\n\0\0\0\rIHDR\0\0�\0\0\0\0\0\0�X��\0\0\0gAMA\0\0���OX2\0\0\0tEXtSoftware\0Adobe ImageReadyq�e<\0\0��IDATx��	|e�7\\�$$d� ���B\"Av��̅0.��	������8@����z\n�*��+��aƠ�5 3��K�\0&a�:	;Hg!@\0�N�I�<��TuUuw�i�NwuuUuտ�g�~��GI�C���KJJ���}UU%%%����{\'\'g�������	�� ��P+,�^�}�;���>`7zt��I�Fgf��(L�@�����%˖���\'��:h$�y��ϝ���r��ҹ+u�ꪏ]�Z���9�g�%$$��*L�@� �U��,]�����-i�����=^�#G�<���0��՜�{��#�S�\0m�g�zz�qx�	�+*.�>#��	�66w���VSu齷�?S�^�;}�Dy!p:��ֿ�N�	t�����_�z5õ�s�J1�no�{28��W~�cܜٳ.�pT�	��7:!w\"7x�=m.P6��m�\'�o���}�8��edd�_�ȫ\n&��uh�5�<��\rx����z�^������_k��K��bC��#���V��R�	�am�!�\nm�?UA �v�����(ͷ\"�:��|�G�\r�;.k��-�\'&L��+6/?�m�=���[\Z�\n#\"�\r��V�z���8\r�O��\0\'L��L��U�Wϛ�/�9`m����T]2X���ؑO��0��{��0a��9f@���%=��zgW�z���D�%�:��k�jP�	&�-`�T�6�\'�}-p�TawM6]&61]T���`�D�&��ۼy��L���o��돈l׻_��{�յ�8$�K�.��0aq7#뛒\n� �Oo|�q�v���w���dY�3u��$�&Lp�	ƹ���m`}R���=p��Y&L�@7[��_��6�\\����n�,��Ep�,��,L�0�n�\rX\"Ȩ{\\��\r�k��m�GÓ�\"�&L�@7{�t(]%nhݓ:�h��o	t�i��Ir���R��\r��8&L��5CfdI�����9�.INz(��	&���JJJ8<C��.����\'���ŏ%L�@7櫪j\0�@覧��n�an��#z&L��%���5<���n�ܞ%��0a��{E��p7�n�>��za����YE��^��@7a���$�C��;�	��B�0a���L��K�KKKš&L�[��nX\"\nz�	�f�22��ɑ��\n�T�0�n-��xa���Pt���\'�j���&L�[K�Lt��}}ȳ/���`i�����o��*&�-��j�-\"ʏn\"� L�@7;�?�C!L�@�ezq7a���L���DE�0aݼ���L����jކ�E�M�0�n-ʘL�H�\n&�͂�NN�\'�DbA�0�n-ɒ{7�������v��&ЭZ�q� &��]-g�ʿ�T\ra��	�΄<�0a�lZ��X8w�ҳoq7a��ya�6=�g�(�n	t&L�0�nv\r齔�&L�@7/,�Q��3�\Zw�c�	�f�\Z���)��]b--/�&�;g*�Ӧ���&L��0a	tq��0�ϳ�\n�ڋ�.L�@7׍���L��^��hE��	�f��jBT%�*�	&�͞s���?a	tk�&ZM�	�慡�����T�0�n��[/?�Չ�	tk��\0�$�V,$ބ	�f�F�nP���9q7a���Lq7a��yal�g��	��%7��h�&L���\0�R�\r���JJJġ&L��5���)�Zj5�>S�/�V%~)a��	&L����Fz/��	&L���.7�{�Uo9e�vTi%%%�*#n�U�����W��U|� ����J�!2��L�N�0�n�\Z�6o�Ϣ�bE�\0�M�:r���A#Cm�#�݊��ǎ�R�c@��d?���J[�	�֊pm��|�>M�l����_�����ɓ�^�@`�0�n�Ŗ,]�t�2��;���7 ��k�������c���]8u���:�C���v�W�Yvi�%\r�{|b��_~^Q�����5��^W�n޼,xz�q�k%vÏ?��:�|z^\\��$:&n����;�����#_�3�SO��O�/{�\\6l��}\'���O��5�w�ԹI�4{�����\0�Dy�c3_u[[\"$\'L�[ˇ6\0�\'�]�ح�)��cĘ;B\n݀卸;>m�P�w�����\Z��;��z�q�zO\0��o��\"�4���\n�\rl̽���﯅�^\0����z�6�[c��yt\\R�ȧ:\'�%ɡ�	�ũ/L�[K3��7/?_�U\0m\noTa��w܌�m��l��L�G�ڔFh�>�wƴ�n�$9۰d�2q��֢l��5����Ц\0�+��z������w�2�A3�>Ӱ�~�ebT�0�n-�V�Y���$�� ��?S\"�У׍��u!�@X����N��K�	�&L�[K�w\n���͝A���׆�u�%(T��\rp�7o�M�@�b��Ir	�;��\0o�q�-6>J\rX�=���������0a��ް�JQ\ZFqNq�	�Ԉ>)3�(^DTg��n�.�a�Z���I}X�`�s��f���\rF��V3a���^�ѱ��\n�S�.}X	[���f�\"�&Э���cF�x�\\!�Z.��0�n�ؐ��T]\nA�Ӟqgw&�-�-�0ޠ�0a��yg��0B�x\n&Э%[FFF ܍.L�9��\Z�	tk��d�m��d�m3(@ޱ0a�4�[:>9��!{�tp���,�Za��)�I6�ٕ�I�0�n�h�Ǧ��2w�Ă0a�Z���P�G�x�H�\r�b�B��<0a���%;Yi�1q$z����j{[.L�@�V᜞?u�2ӑ�\n�)��\rx�2�+L�@��&lp7/=Sa	t�l����YM�Ia	t3�n\r��Bl���	&���f,�nAoг\n�u�	&�-\\�FQ��p	�a(�$�*���9u6�\'r���	�t<3=t���%	�qa�Z}_\rK�\\c����	k(��J���\nF�v�gW7o�^X	����n^���,=:v\\���@N��*�	t{��p���\nG��3�[[��)��������c�ag\ZҔmB�D��蘸�A#cS1�d��E� %vK�q�@6�P98h��&�[����yy�k���x�=�H��{������ac�A�*�؀��v�\\D��3f��Ǔ�\r����߿����o?8���ׯ��A�<y��B�	��6}F��_U�Іl�O�[����ޠ�O���PjH���I����6�nK��#%\'u�SHl��;��&��a{���O`m�2F�ch�&��a�v�s���H��CgIr�Ȓe��\"L�[(Zq�G\rĤ����\'��m�͞dj��\'�j1WX�]\\!��������]�A#5��ݯ�\rtk���-5����H��v�\rt���4�H�X�K���$�!L�@�p2{��\\��\0��`4=+W���O|�*q��rf*2��*R���݄	��F���]�\'S��	tkܭAd��J��V�xws�/B��0�naoLd��Im�١��c,��n]�\'�ǅ	k��-�y�\0\'��	&�-$��^�\rp�j�\n	toK�\'��MIz@�Z�$�0aݜ��2��q7@7�O�g�zs�������}K�n����dX���G7��,�ۇ�M��#v�,Y��(���%�Q���VC�� .�ߩ�?��ѭ�wC�f��Ĵ��dkH��RU��Up��\0^\0���1.]�oϦ �z|�5��MA�_�m:�;�\Z��)��T��מ���6���cz֮�^܍B��$�g�Qh�O���7 MKe���p�7?�����|5l\0,�.=+*.ƝJ�M�[<SI��s�8{խ-�&V�1\\2@ 8�6hL� h�0��&��\0\\`�	�W�^����qF�3\r�k\0g\'�]�V���&�w�*u�!�E7�oF��Q��SX�@���s䙠ޠ�-k<�Y}�7��8�p��7��1C��\"�Rm���i)0�\\�LUaD㩐1�\0���C]z��y��=D�T�Ú�Uåަ��Ҕ\nts��eOɃv(��kC��Nzb�K\r����+^��,�)^�,5\\�:իUåԄK����s���z��F�Zص+��\n�\r3�\n�C��)����b�A\r��8�f�\n��ْ���pوn!�+��i�~v]l4��v���pDo���nz��Gg�K>�8lW���%����IStL\\]�=��A�6�%gyg�RO\\�w6a�y3��:4��ux��#PW�[a[�2����k=�5e<�uN��G��%9��w��;C�\Z�r�+�߀Q�LT#�:|K�L���19�C[b��_�y����@\0+���tK[�g*N��\n޴+�g؉֥ȡlXX�C[Ҁ�zgL�9�w�o���=��z�mX�r��3�&>����8#S��\0.�*P3G�`XS�|z�{|\0/u�\r��鍻\0\nՈ)<�`x������9z�Ҋ1a�\0���Y��ѽ<���.����Xl���/Υ��jFgf��z�����Oy$R/	�*{��a�)����y���;X!�6�g.�\0�S�R�x_[�[���ׇ�����S虊Vvah�P@[�ȧ���g�n�,E�xy@��4q_���#,����9�߭���S,	p	�\r��\0�b�_�Y���غt�2EH�A�Լ�44Ky[w#���K,W&DX��:3\0�І��hׯ����^x���z�Wx|�����V2T�\'E��g_��Y��%�{h�`������+y�Q��A�x�QmGI�ԪU�[�\Z��n���7�5�6�nh�k\np1X���Q���g�%���3Œ�9�,qk�Mj�}��n6j��\0�L��-{���y�E�X�>�<�X�wK��\0o���!�dh�`�\"t���c���F���O�\Z&�Vs��^1�0u���i����,��7`�%�<KoIu��ޒ�_|jc����jE�/s7��7���l��i��V�C������<�$�sEf�\0�ԡ���v��$��0^�yI>���nR���5�\0z�͆�%��iSW1��#�M�b�9=hS�!=h�߀k��%��E�/0�@LE��\01͖��#�n�4��ѣo�n�4,�vN\rHe _-�͞�(�X��}�ҹ�ӆ�!#Q�>*|XR32�%Y�4�[��%�2��\Z�֘�QG�Y��Ca��0/M��*-�>=�iW������ґ���#K5�K��u�ޓ��!�J�%gjV�cC�ӦaD�¥�?4m��e�X�$�Xu�3��Y��Nd��#��2�K>\rJ�P��jE܍Qh���p3��z�n�H:X�!�Ͷ��h@���F�6���c���r7�z~;���3,z�Zw�̦o���,̠�N��<0�+K�f�A7����R�s��`(��\n��D��f�8�E!B|�m��!���9K�Ɨ���\\�,cϔO�\Z{�aуպ�[�!w���U����mE��\n���n��dL3�!(��c�7�G��,b�\"\\z�ZwKW��lhX9����GTElM-��9鮾CgY�6�y9��!�gE�� 5a\Z.=X��(�j��Y�Ag�zDU���5g���i�3�ټ�ԝg�S�ؓ1IDӈ��V3�eVG�x�҃պЍM��+y;J�X,\\iSSO���{�A3�n�6>�i��;��҃պЍbV�\\#X�{� �険�*2�3��J�x�qc�^�E�7y�rc2h��у���\r�A���\n�iW*�̠�t��d��Ѵ�٫��=��`ļH����`\\�Ƨ��b	�Ї6�ݚ9n�|=�����\"辪�����n���!vn�22>�E.�3��aԃ���-Ӑ�u�\Zg���@�W�{��b�#��9���z��1#k�?ߗ�N��0\r�,4i��݂kB].p#N�\n�L�\rFF�Z�\'Lè��q7�{��7�> ����\"�Y:|���Q�Q!��h�4#3v�-t��OV�C7�3�7�:H�wS��5S?�L�s���� F�bd:Lç��q�ƒ7�Ҽ=tC������M������w����xآ��1a\Z^=X����mz�8�A�*�q�V��+�w�n=���ؚj�W��Ճ�\Z�\r�w������ˍ�_�xζX�n?\\�i4�ݝ�i\\��LG�6!����=X���97]3]�owP�HE�`�X5���${����h�<zx.�z�Z#�!�֛��U�Bt��[�4T�t�ŊbĊ{C�|�w��e~âQAj��n�۫O\Z��B�JJJ}8�ʃ@�D��s7b�.�k#a\Z.���+yӣoV�\nݓ:I���-��ě76W[�,Y4Yc��o\Z��.MNL��]VkD76]A���%��@� �f5«<���U�W��bE\'n��]S��B���tI^�<,z�Z#�1R��6�,��b�-9�i5Idt\">�8Zv{�6o~>��X�H��r��D�]��ɇ��0\r�,�VwKHH����Ҫ�e�9gl�n=ZN������d�q�$�Q�����9��փ�\Z��m���A4{&���9�i��k�����#�����҃�z���ݲ{R\'��t��M�\Z��5qۜ�b�ћ������)b�4{�Z)wKG��.w#��X̂�b�gD�qzs��B>aJt`å���[BB<�#i�3�kX���[�ؼ���XY5cRִy��\nyL�N�0���0{�Z)���)GbfC��ts*�FYO���t�����`M���i���h\Z��(��ݍ�}�؃����n�F�M\nə�nH�����DFw�u� ʴ�F��� �F�g ���ww3T\r������,]�خ���@�-���FC\r��\0#G�(�%L����V�nRc�TOQˆʛ$��t�RS0j:�#���˟��-L{�Z/�aV[��YE7dBD�[6bm\Z1�fe�3)a\Z�=X��is7�\Z�-O�MX�F���RR~�؁�O$&Lô��[�w#$�W|�b�&�u��Bb�=a\Z�=X����MmhX��uc�j�-}o��p���ԻYs�*wsD���0\r��֋n�%o�4,]�PN�2Y�p�п��Jx�V��9N��9��FL��oV�E7Vo�WCd5g��7�\0΍�q��oJF4bE��\\�jFb�4|{�Z/�%7��1G��[x�x���\ZQs�8\'�>\n�(oIL��oV�E7pC$�eT��E�a����L�7,� I��sĄi��`���Rp��VT���Jr� ,=]\r�QEE�w��k��\nn��j�-���]�9�!ҥ Y���H\Z22��.=a\Z�=X-\n�\0�V�^�Naa���,�0sf����f0��;Y*6:iN�`�\\���\"ǌ:k���F���H\Z�\n��F�4���x��V�:|�[���\r���yy�RocbXu��ݐ��-��z;�݈��<32�+ R<b��0\r���n8��-�\r��|�$� ����XZJ j�~�N��7F��9�q_��\\Nb�4�{�Z��m޼�j��/�_Z�8ox�4�z\0��aB|<|�(jt�ـ+Rϑ�iX�`�=�-Y��*�1�\\T��1VS\0��f��n���������\"[E�\'�Ɉ��ͪFXj�i8�`�7�[�l}�vm�&���u�ئM�]��l�0\"��¥�h�9�\0>��Pb�(Q\0�B�i8�`�7��x�^� ٰ��Or��_��gȈ�j\n?}�w��a)BZ�Ms��	�Ga.\0GL��{V�7撌���HϨ0�(Ѯݝ�?�:l��{���i�3�;�U��G���@7��PL\\�\Z�bD�q\"w#��:O�gʄ{V���-�ɞ�m|ѳ�Ja;t����\0�������}�JM�R!-=nhO�T�g�fjD]��SgA0�{����),�\'�\'M�Դ��r}�����\0.k��Nq\r\'Jᆕ��p%K��X\"�1~��FB��7ݐ�C�-5�7k��nb&��<@���@7o�B6|�@N��o,�0:E�~�w�֦,mHr��,�\0\0��J6t�Z@k:Oco���%C�|��&ӈ��at����L(�	��ľ���3���H99��)n^�[}��uϝ>Z�t_6&�]���ɟ�T�7��-A��Yϲ\"=�5��d���1�����ý-�0EE�6n)?�����_����v��9`��~�-\0\0�=u���m$��wXD�Bӈ)Nb�\0�.��)	#����JJJ�\\4u.Z)�5y��;ܶ�K?��8Q�:t��j�������AUP�n���ȷ���!eD�q�΃[D<a��1��A���+���*�����ҧp9�ULN��:��1��nv± D\0����<������Z\r�ĄѸIK���Ś��Wk��Z�-�ٶ�x�D�����lw�g����ZZ\\c�&---6��@6��;o9e�Ș�浡9N������F��`�|>@�����@d�1��y�rr��%_v����PҦ;��_���`��w��-�\"W�\n��H+��a�W���>�;{�t?�qAI�6��!\"��kh�˚��O��^����.gϞ�o@�ƍ�	�)�ز!oi�#B*���g\nH�N!�v����7&�[��/�q�Y�)�5��� \'g��YVݵ��n�5\"����מ�x(��ץ3��-�v�䵺�g���B�{�.��ݖ��\0ޅ��H�g�1q1��.],�2�4!!A(��\0�6o٢5ؑԁ#�ߤ�i�;�0÷���ڲz�jx�p���\Z~�Ƥ��(i(y \'{���Y-�\\�����f��m�!�Ⱦ\"`g���\nx�X�`��;G�\0�#�x}1J�T� fɲe\0m|�l�;>���)�F������o({r�|��o��k����e�����?tc镪ƣ�,#wNyV,��\'�]�v�<�>�(;P�o7�\Zk��۶�m�$9Nw�w�bz�A!n�4�8\0���tv1�^�)�e�k5�\r�{����nl���\n���7%1����uƾj��l��O>}F���e)mjU�׆gj��Jwo�5��0ת_��pY<6n�\0$n\\V֣Ӧ��\\����k�S#��\'f�|V||�܉<�!�\0�9���07�w+s�����{���p���̞�r�\r�\r�E����IH )��\r|��c�S62�nUgO�ywki�5SCD!�z����B�����eʴ��t,��{�L�\'j�E��uD�8b���\"c��FfO�k��%v�	�0꞉\\�苏�C����^[�f�\\X�[f#�nGtKH�_�`�#�7zH��rܮ�|������W�����ǭRK1�r�����qK�~1aB戚�+V�I$�y�~n��4��G��\n\\S�\'�]������V�<ZQ�V[j/5,����$���SǻF,�\0 �yV\"{����|�W��V��,ܣ���ի^|i�O��k׶m8�Ϗ�*\0WK�#$LaU\n���\n� �bb�=�\"z��|�0\r祴�!�LEE��-[&O����_�nlV���)jXZ\"e��x�V[��Z�I��4���9�.��ڶ��.]�/^���\r�M\"j�_���nѴ�Y�HI��z�����3g�\\E����\0a\0ǰ�ʊ�!K��#`(PT��\r38,Oo\0���U�`������]�p�w�3k��<\Za��5�22���͵�N�\r\n5,���Rčq����޽�;�pmʴi���+�x�#�t���1&*���\r��a��2��q���I:A�O�\\�U��!�����{����S\0���&�D82��A#ak��M��n���o��5\0.��m��IK�-��/��[NN�����˟��64,ݓ����w/������\'L��䯑��OK�D7�s\0�N�,�C�*t�۵w��ItL��Ma���u�勵|�CE�~	�T�Z�6m:HU��M�E���A<-��㔺3��h5q����0��?�z���g\"����=����#)�-0��Wt��?�Dp���*�<@�y��_X�<��\r�������9���4)!>ޢ�����L-N��Pòw�.�Bo·�.�����qG�y�s�?���!��H�6@12�!	7u���=��7ل��a�����f�/?�U�=��\0s��\\u\0���{���\n�9I�w���W��)zv�0�����i?�0;�ɿ�\"@0�+���K���]�z5v��7�}[�f�_\\�盐����M�v��=�̕�̞\r��diC�[]�hO��j���\0�,~�vQ�f���u��U~\0�y����Wu�䩣�\0s�+���c;�՝���m�`A�)+q�l̔���\r���g��7x@4x�>��\0d��ա�V���9��]���b���.]6ZF���3]��ա�GHr�`�<)���W�^��B͑�r{\'\'�MIeЦ�&�����V�{G�ˋ�:\\\0d��ƀ_�5���B���wr�؁\0��.�?p��Ʉ��Qs�(��<fb�\"}�<��_���\0?����}��k��5]�[y�$�s��=�c�~�-��\r;�p���-���<�Ir�/<|���R y�UU�Ly�P6xqlV��]�*H9�aj\0m|쬺�����HPK\"�fL�d~�`3x�����ň�m�*6Z��:�����oxh�e����⣿dO���>��\0OV�^���eIi)������VP�bph�\'�{�m���|����S��}c�>Αvm�e��_�6lX��K��(��Q��1�~xd��e\0s%�w�8�5ǉ���UlV���7�E���7�q�fp\0��������B���F\n[�n���\r9S`��RS����8`m�e�~WK�-�C{�bmmqqqϯX�)���mc~r�%K�����b���_�Ц0?�=��(k��+���l�Q��Ul�n|U��\rOxp��;�߹#7�Ghc��Gﭘ��0�1z^X��%���\0����뛒���S\n�o\r>�gm�᠗B\rKK�i�2!�mY�>�2m\Zp7M�����WVV�d\'3w�쵅\0m-��ln��Z[8�W��\\?�l!Qs��݈��.Ѵ�	�O�\\��8���\0*<<0��a_R\Zo�ҵ�i#\0pɽ���CDD]u������m�v��}���>8ׯ�~{S�N/]��|?uT.�C�>�l\0\rP�w�ˋ�&c�n�3�k)�F�~Xͩ�ܤEC*����$.��$2���>noQs�2��8\n��8��ݓ�O*iͺw����o�|�Eݢf)=�p�9���f����v�\'��iL�w6�N�T��p�?��rrŚ84�3	��%\r�\0p�����Z��<�X��勵�O�\\�+�����,3�տ�֝0�۵i���}��;�}�Q*B�=�,��F�y��7�\n�\\˻��N!GiQ܍�����s�=�ֽW����e�o���aϚ<�G+K\Z���2�o��fIR�d�i��}(�Vu��쉊C��VF�@�.}�u64�6����7�\0��f�a\\��o�ݹx���_��p�����=�h�IQԈ2uA�0����Z<�����|-s��s���2Ġ��oo{k�i\'�	^Sk�Z׳=���4�(0.u��)�l��Y\0��9�ev����\n���_2`�mr@�:lL�ˋ\rU�O�F7��2\")�&h~�	\r/k��V{������v�ǉ+++y9 �웙U\r��]�~u���R���U/��zHldB�s\0SdD�_�����݂fg�\0�\'-zH8��\\�;y���6\"e!j��!�\0I�\Z��olU��bэD��猾��A���uQ#{��7~�\n\\��]Q@��}EG�j�0�Q�٫�L�`y�&-��ׂJ�׼��#eT\'�V^��,##���\Z��,����*��p�fM1�2�qYY#�q��0Nf	Y�)ٽVaN�6��ٙ{��{L�\'6NY%e]z��o	��^����+)-e���3�7���y���\rT�&.f)���Mﭜ��&F�Ξ,.xU�oI���0Z�y��r�2�K��{�lJ\"�&�]����v5��;�^@�X�K��\n��G-��N,�0Iٗ��=y�$�`�xe%Q�9��sK��\r����v�E>�mƕ_s�|rΓ�n\'�O�oxd��?3w�qRE�n�b�.��O��6{ \'�Et�7?��՚Tn��-�L$t�9}}�F@76�A��͒�������F�h=^���.H�L1\0.7�g�f�����M\"���=z�n�:L�\rp��!M����������\rg�l���*��(�Ж�b�mz^v�3���G���UEݙg������eeࢫo�<`YҰ�d��!w��������F+TV�̠2�ӆ;@�<�6��I�-��\Z���Aw��p2�@@/��r�\0�\0抋���()-\rp�:x��*�K9SpEM���	��.��\r�g�,Dd�෷�����A]�f����׭&���|m�έ��9e��M6��f�1�Ⱦ���>����5���ޮ��;hD��&�5�-�\"\n��	Ӕ�#�%�h)8/�I��q�ecX��U�\Zm�$6�o�\n���\Z����w\\ǎmڴ�|����zw\n��q�(j�+8�|���O7l�f�>6>j���йNҲ��8`���}ܣs5]Q��a\\Vւ��g\\QaB���N�W��*�4��GX���\\�_=�o7P]�r\07W�g�\r�h��v����)%�K#��?8��=zt&����7���d��byII��-[�A�u�|A��\rX�-|\r౦@����� _�-�P]\r\0����R�lM8���z%oV5,���@�c���\'�3��6��)x�������շ�mCD3�R�g\0;C����$@lV������r��p����r�GD}�G�	/��_צ]����\'H$]NJ�j[�\nM{K��P�a��/d,�$Y�t�1�P��k�G������+V�\r��І��_^����/��zc	�m��ջmZB+lW���QT�&����\0��j��j8�ƀ��=i��������\n�p���Xe�_�xk�}��08�\ZC%�It9))�$�A�O��-͙=�$4��y�X�l٪�k�x���糔Σ��\0���]�\\�o7��p.}����e��mԓ�Oi����~X�.;g,l�o�1\'��w��S�U��P�Ҕ������e0��mj�p�%�	ʫ�)Y8T�6ҕ��q�h�E���7u�W�͆@��\Z�C\\�[��.Du�.X\0�\\=u��Й�atc_�����U�-V��]o�ˀgvf��o���m���sf�\n�F�j;��n�|�^�P�y��DL��*�W�Q-��b���<�K�o���>ڳ�W�,�_�ېK���[�\r�Ã�����݈�㤦wba޳�S�>�{z��G�C����{�u�׹Wg�d�{�`Lǈ��dO�立8�~�k����y��I|Dgf_U��%��|znR��.�##\"��%˖y]uHt���F�L�٤+�b��j�\r/E�!��*X>�m7�Fᜢ�\rԠ6�އ�c��¬)sCڔX�;����ª�\\3��ң�\'j�[���As\n��%�5�T�N@G�\rpmٚO��W�<�n_��	}�Hb���⽕��/~�_�đ�����2�O�gڀnf��kׯW�X����3\\�W����͛���|y ѷ��I��>�.����\\mӦ�?�)hI��j�/��x`X|�\r���+���ũ��oڰ^Tk�e��?|��h�<Jw�()�A�\0����,X_u­��h�jVcsDI^�<\Z��b��I*�i��_{�K@1x>��Xe�B��䙋�}�܂Y#�R�CYI��\'u���I����s�v���bnD7Im���D;u�zB��OEu}���K�4Co�4,�wC���`��ii��0A��CQƒ�\0m��7tZ��ݹ�8Ɗ�n�M=��]�6��81�F��l�B,�{e��Bosf�\n������\Z�Q�t_�)������u�XnA/X���J��\Zm�<���\'\"!�ct���6�Q�fC�x\n�`e����{�M�s_4k�;��y-��Ctl�������WV�����#m\";��U����$ZJA�c_�{e��@Nv�{����2h\\�ch�o��^�\"\0н\0������\']��3s���t��rY]�z<}�mQ Dmm#bS����q7K���h�g�%^�`��0\n+(�S�������L��8��Pu�1��V�¸��\\@�l�Mʹ�k}a��u�m;�.]I�7��z�M���{5H�QjٚO���Oﻃ~wq��ww�����6~�҂G�\0F�ـ1V��.\';���[II���^�@�R$�>^�H�p=�s�Jw�P�/�\r;����f�3\'OW����d��p��(h�b _�z�����a�_��cL�*���;��\':�w�Z�\rIj�TO5��9=r���[�\0�W���6�I\r����7�_�d�=h���!/����n@��),����\r�n�IƳ�5�hE��}�	�c;v<�Dɛ�)�\n��G�\'}���$@�^㑱���Sr\r��G�Ag��O\r\\���Q�*;�a5ǭ��SjV�\rHt�D@7��߼��\n��z�1�Ff%�UY-)))}07�\r ��F	_��n��wK�5��\\Mc�����Lo����tѾ�޼5��ic\n*���}Ej�y׮eK�6�ܙyϿA����_^�扜�O�%t&Df,\0[��ٵi座Y1�g����VE�p�:��s#j�3� :��?�P#r6x�x|�����܉�\\T�$��i�`S����e۹t�2V����.��2��\r[X+�#������3K-�\Z�K�o�%op���(�:�\0k��\Z%��/X�LpMOCM��kC�@D�@*#@f	�\n�\r_ee�����sum�+L��9ΐˀpQ�W� g��){�g��\0p��H�WG/��9���ԕRD��䙋,)a�k�RS�,m(��<y�k�ytcJ&L�� �j�wN��ݰ(�j�-9m�m�A�l��\0���\'�����	�_��x�}��/`�i%���ͥ���bv��-d�h��/S�W�Јi�ob��Oo܅\"2v\\<�1N.�(¢6S�F/��)��y��װ����w�_���rW*B�dm�-��\r�{o���0�ߡӀ�U�4���0�j5m�Awͷ2����8��kf=��K C����~��=�b�/&L蟖�l����]�P9�W�뗂�[m.�0_�yA%;��T����\r>B�\Z��U���R7�x4��y���FLU�����MI��p\rx���G��T������3�\0hw׮�YYT���6zCpfeT�Q���,*���*�J:�c\0�Ժ��C	�)Ӧ��h6;&y��@��KBPs���(�U��Z	S~��ױ������\"/\'\'+�0#����.����D���92jL�g?.�:��d��E{+���-��T��ϚeC�ѭj^�o���M������\n���r��\r[\0p��P��&t�\ZGO�:8]��\0׶,~�dz�RX�&�,�2+����P$:nz���. ���+�t�N?a�I\'\'O���9X��������~h�f񭚸���aBF��7G����6��u���/?�-/1�i�׽�_�`n.05m\0�sf�Ѐ�=i[�Ѝu~�1b	P�\\��V�P����@�p0 �����L���2�Ⱦ݁p����u\rK5\rу6�߂�����Yׂ1v��W~�ì��U�h�S�v����j[R�w��pŭ_����S�\n��a�����uڊ|g��G�W(�����eff^�;w���O���_ہ\'k@���\0�}a��@B�.��Z����u�!�b�!sfς�U����΁w�.k2D�\'t \"��}w���j��-��XA���Wh.~(?}�M6�%�[��WTQv�`�B��V?�p.�u�ލ�9N�c#��\"�;��)3>?�ܻ	����_���WQQ�ֿ�ڶ�V�G�y6lŜ\\��9Q���#)��5��\'?���Q)�Gg�:�w�`+�*xs���YC���w�bl�����}��6,5D^��;�>��^�� k��֦n\ZU�Y_{~�r�h��=���T�v�Ts�f��Y-ۼ�G�\\��uo���P8z��c˽K�GD�q�PQ>]�׈J�wT}$.���o����_h\'R�|��gM�\0\0p�����|�\'~���os��qwZ��Lxol�x\08pQY_�p��P�|U�׬f�f�Zal��a)9T�RYaB�nt\rK�d�WK�&�z}%_��͛��6m؀�����3�+��PM�%����p�p��K2���;�((�[*ђ����U�q1=ׯ�b��5ڮ@�q|�����e�vL�����I�:~�&5�Oϛ	.*p��9�OM�Oٽn���������A��S�P[ʹ��؈�(�>���>y{ܣ5|m���-��\nY��X��1t��ֆC֭��!�\n\r�(y�*�v�@���\rU\0�P>l=hbo<%]�A$��0�=\\�@��V�_�N���;O]����~Tjg)���J7e���1?��]����~�Ƒo�o�\0�tٿn޴�K�a׺ܷ�H�tO��~�z�x�B�{]n�ٴ���������yP�\"�XҰd�:K�,��\n�F)�f��l��i�d;GP�+O6&9mp ��L���iۍ�C�\08�_X�K�\n�qro�y���L��$Ly�4==]�L�.ޫѱ�1b鼻?>фz{D�ѣ3�rb��\'�k���3Ia��n�{a���7o�Y��G�?����Z��-�Vx?�(p�8x�έ<��а��n(�1�~\n�)x���7�e��?uؘPVC\n���D�\\�9�K\rp�b���^m-Iz��Ă8��t=\\p5kK�ͤh//{�}���Wq��u��1sx�&n��0x@װD7\n��3�*���ٞv�c��$�]��-�F�,iXڨ a��ŭ�M�6M=<��mۖ-Y�v���{8�AM�ӡ����h�՞9�t�4�	�2J3C�d��0�7I홾�Ru[�$�[Z�7�����x��R����շΣ[�PA������_���h�\\>�e��s�t��{R�gd*��~.xz�&�?���O��W@vn�Z[8�އ�W���aG�A�e\0g/Fi�(��Q�eQ���lU�-)�x�kzW�������CN��)��õq��ً��:mB�T�o�[�U̬Z�7��~UR�G��Y{�\n	�l:|����\\��jՋ/�5n�T���?̶���N+\n���c�\nm#��9·�����KIP����P�ֿY�N&�G��T��_v�2��i�<\0��&w��***6o�נ�h�9������`}CT�r.�c��ͪLH|��nI�\\��l�B��.�Ь)s�<��6����M�U���r\ny/XmPQR�\'T����wlF�x4@����_G#6���&�NTȡ�e�,���E�s�m���I�M��pY��hun���5bL͒���J��Mߪ��}~�C��Z�ٓ��\'XE���\nl�Ksp�PTc=^$�pS<�|M�g�\nhv�t�i)	SEV3��/�����ېm���};GZ=D�����o���/=�n����/�6��P��yy�֬Y��U���:��۶9O>i�~unъ�jXZ\Zlj��F+I��X̸G���5�2� ?}���#l%zs�&���,�C=^uy��0������J�� �g HHI���`�P�\0e�1�asKe!���n\nL�m�_�XW�Hn\Z�n�\\�������d����ڸ^�܂���٘��!:���#�D�p�ᴴ4�}\n�Q��l\"�c�\0�U���ֆ5�U����/9��W��K=�`E����X\\��m�mn�Es��j5JI$L�z�4�@��:��j�\\g���`��PG�\0[�M�6C7l�,�k۶S\\�?�XUS�*�����]㲲�~�&`e7]tK���O^>,y#r7�\n@gN�T�?֨?n��G;�o7@@p��5�V;�o¾��:l�%NH�BV@������5�M���\n��#nV��%����C]Xæ�|}�\n{��M�V&\0}�h�;�n8�\n�<>!A�n�:<4����_6��8V\0�Ց��Q|�u���޲�n�*o�K�)���Ң��}�F=N�.W`U���yxW��R�I,ٽ�|����6\0R�PG�s��y�)�<L���.��R4Ǜ��u�ee�=%�z�4�`�T�n�F�����⿮_\rt�l�\nĚ%����m���U*������)�zt�I={a�M3���O�������j׸�U��aiu��=�y�)���q^�^Q@[��4��5��B�pPl�\'r��g��a�ъ�7Q�b��2��%e�Q���5�4��6� |~��*x���f!���_L�FH����B3N�|-\'\'��\\�TS���>|g�}��������Q#8-6(��[�_Z��8^�D�.�J�^��a��\'�0.���\n�y�ٳ�;�q爱YY8/&,���٫��>�M����j\0�F�)Es�6���^�/�����&$e=X��m��t5q��lk��h�ֽK�珲@���zO�*�{SVCM0�];�u;o~�;Di��o�@���.#�����\nCQ4�\rX���9�͎��V,�a1lV���R�S�<�P�R�~[M����noa4A�M�y�e��~T�T��M�xG�.�0������{�nh�Z��W���f޳}�bx�\\�ɛ8k���Z�[\0&�R֟߀Oji�&z�V\'ci:��\'u��.3�T�P�9m<T\0�Rۖm�h�S�\\��L�Y;��R���qjk�]���M\���覷\0j\'ϝ+)=\0�*��e�Z`��5�i���Ao�e/	5,����X��5�_^̏VG̲�q88��N3�ѹ	�sI���9NIb:�%a�/�u������bD�n�W��L��n7ix���6C7�s��-q�2�ڵ��-�p=�e����}�k��*�B�%o��[֔���8p���z��S�M��׏�r�ǭgiB�\0�W�9=���;�ը���Al�RGY�jY	���7`m_������Q�k���3m��l�V>_UFF:�<��������V�\\�^߰������?{p�n����ݹ�Ctt��6�ְ0B����5�1fm����Iuu5x��z��U6*~��U�AOC��*8(2�0��\n�»��P4�)e�u&$:u��	SE�Tis��T�֫�e��\r~v\"��[Nv6�[���ɓ&͙=K��J@�\"W�M�DZ7��_S��~�4ʋ��{���ڟ�?��\0�����O-/X>��h�<�kS��۪_2�o��#9M��Х{���\r^��M�`���9)�;3��x��%%Ǎ�II)��f�6-��;Y���f}�-�]�Dk�n9�R8����y�E/��V��V� �0�tɯ�]J�D�|p����cI5�[�z���~m�2�ܯ�$�m�z��z)\Z�jб@��h�����<�a���?��C`\r���?D�q\n*��J=(e%V���&�8􁚸�>�,\nRo�-�!|�[p�-!!a�d?�UTT���݀(�~�%StsIDϢ{��ؗ��4٥��_��9�D��	�)ю@�ȹ�����b�_��:{�o�N6�����C%J!�(e%��;����\Z7�-�f�z$�\n6��!e�;?���7q<����3�t�R~0��[�6һ�m#�jb��N5-&��>���f͠��7hcͧƣ�:P:��o@�Pm<[N���C�z�B�ީ.�Es�R�F��e� BI��)���D����]�~��EJah\Zռ���m;���8̥C� ��gGa�J/[�0Y�F�j��!��OKS�����~9�ާ�\0����?��_�\0���6Ö�hK\0�]Sr �9N�nf���%a�uS����\Z��w4���RIN96\0�����+��M����,`s�ڥ�̙=�ʽ�Õ�>f9��>��;;?6.\r���x::\0��Re������[�,~L���^y�?�9�㕕�<��f��\0�2��?{ma��o���\r�|ҢW`/2��®M+�r_�����!~���u�u)�w�6��m�脮��kS�w�d��ֽ\n�~��*�KO���]�\0D���9�:,����i�Q]F�mطp��9Jyֱ���$wxC����Uh���kCmʴi7k���m�z�¬5�\0�	�y1\n�5�AT}&�\n��3�֥����8�r�U��+��$L�{۹�]\0p�7G�R^g�΁�E70pN.X\0��/5��[ff�\\�3�3��^Lvy���T��S�{>��?T�Z9S����	��_i�\\p�Z�h��\0���jh#��h�+����Ӯ�(�b�t�P��r�-=ʡ[rrd�=�pAUUժիǎ��t�O���������\'�.\\��V^��]�4�pY�����o�2�썍��*�Č���jΎV@�+r�W�2W���[�X�<`p��XGft!����aӡ\n{wn��N-wC���9~��ݬ���0ei��n�\"�:+�UT�J��Q�n)K�+po$�#s��y��������ǁ����~���ku��]�Ѿ�o�[oJ�#땆�S�6�{��m��>y!3��f���(z��؜\0�P�2Va{ZG��9��m�솆��f�6�\\o�یC\0���U���uC�9N�lU��Hĭ�8�\n^ɡliIIC��z�`��\rl��I�Gg����q�>�<296rdܾ���@����+\r�{��s�$��B߬��뚜��GKpIb��N�8��?ܠ�\0�92&�*�1�۟�6+�m0;����Ƽ�|��^\0��Ot�2��9Η�F9��������961U�D�R\na�O �:����h?Qv��t�\0gV��z�7��D��i׋��~�)�^���P�L�����hIX\n}�Ѯ\0��E��\0C7��\rUȽG4c�\0B~���\0s�*�`��c�ˋ5U�`�?�����[�7U[���S����0��.}ƪߺ�qrOܘ�?~����F�)	��nK��W5�N���������i��g��h�6T\0�k�N������z�e} �md���&��%K0�`y���1hڒ5e.�B� l\'�����l��~צ���x�ĢvM=JS�/���\'�ڶ����.��1#��B7F�®��2��і�__��I��YϭX�_�\n�82���5�^��6�oĕ\\���.\"��<�p�]k@߰]��\Z�$��aP6��\nU�h����ՠ���q{>�cI\"�3c�.C�^��\0�w������\n�S4�M�ti%������I\Z� �T)ک������-�\r�$9�	���yV���W\r)|��OW��ֽ��Aw@����Ú\rn�rcSC�_L�����1�\Z�G4MbN{rWq�W����4ت���\Z�7lW�z띢�4�6��\n����X��\"��!���.3w�)��8���4�5^�����S\nQf�\'z	S\\�-��}�56 ƽ,���n���7m�HD�㕕��K��i�F�~��5)��?(@\rG�a����l�7hN`��/hѨf�������Q#;�ߔ��iӪ3\'�Bldq�:�:��;�\rS���L1.37���	���\ZN���8Io���L;UI	ӯˢ��x�_�Nl�36 ���v��������0�nm#�=�t��A����N�6\r�۪_<v�k�9xx_&u��k��2AiM�Q����L?��yi��5/?lW\0ϴw�.�.i:�U�׿q��]n&�����=:�|b�76��9n\ZS��2����a��z�q�o�-\Znic��Sb�2��	��3t��ղ#su;t�M}�����Y��Z��������N1(�8�@��G����c\0�\0a�u��a�n<��1�zT[�N�\r�{���ajU�R����	S�Ȅ��K��Wn����@��R�p� 7I�K���Vykݝ8\\y�g{�D������\r�YOe֔���T�QU��9�)6>�j#=��3N:�ѹ���kO= ��	F+�MO�2�\rn\'��;�N/���L,��8oz�o�c�H���0�����\'\0�i��5dKc\"ۂg��1<�7��۠]��v�����z5� X5[���`\rpͩޣ��\\����4j�έ'pn��{ƖO��`�z7��f��?-m���\Z\\T`�p��MV�U��1�ǔ{j%��*U�s��l����:w�e3�e�DbmJ�·D\'ܡE�40�;_���M�N����LetD�`�\0�|��q�.j�9ҷ�,�,�}��xi���	�.C��\0�,X��G�xh��_�;����8�^m��tMNI��]�2�M�\r�*T:Pu�\Z�p���a���\nnLJ�h��r7J�.E��4az��iu��m^�;�YЭ[l�\0����*��nhW;xk۶�Ӧ,��#7�a�_\0P���m(mh���h{.��q�r��Z��?^~���u�g	7u�h�!��<_4.+c�w�Y�⋚�b#�l��*�*`&Z�	;`��Տ���S.)��\0��i�4�m��2.˔\0R�\'*5t\0�m�ӂnl��f��WG}a�n�n޼���ІU��X�7dK]r��A��>&�mL�?�X{�m%߻zX�\Z���H���������$���=�y�X���jЀݝ�h�!���L4*\Z�(�u�<�Ym��Es�t(iM	�^���Wg�n�jg�	Rse���x�������T�R�{��\'X����ty����ӫS$�k�3����\"�cB���=}�V�Q*�?��	m�aNw�6r�q����`o8�G�����V��:5�|����j�S�NK�v��M�֦ΖJ�v���n��M�ww\rEt���]GT���������2����	�Y�?bp�X��`Ӭ5�X�S\Z��A�Qi&�|��o��o$ض��f\Z�YV֪{�.,͎��)�8󻿿�|іiE�U�S�(��	SM��}�}ݵ���n�-��,?zCs�1��=݁8���}�w�mY�Υ�k\"1�w�]�\0+�Jp�<��`��\']6ͱ���~5�_y�a�h�kq^�n����4a&�޽�n����]�{���ꍩ�r�ȗǉn)ߢ\0!�C�F��	�{�:飡H��[�5&�\r A.��dj?�%����w!�պZˣ��P\0����vIç0	۳g�_L���S*ǳ9l�V���_p|ma��(�����6J�n뻙�I	�\'L�-ר)�sK����$�DsH�7��0�1�\"�o�5�#nzc�~~[|�Α\n\"]{����U�5e1��?����������eCy��BF+4�����#x��oP�T�_*��6 n�c��K�:Mgԛ&L��v���-\n���dq7�!�zn�b(W���:v��B�����i����	�`|m�uL\0Z1�~\'Ӱ�7�E8)}���\n�C��u�S��;�H������a�r]�b��%Qr�9>Wy\\Ƙ�wmz�5�js��W\rOW����g�n��f���N�^�d�0���t��n)�<\\�G��L32����<�����_�/�~RC��F�+����א����L�x�Ԇ���a$|d�n�`\'ݔ���6@��KS���Z`aN5�Jc�\\&Ex�59�Í!7�y{�,D���ٓ@ߪ�_hw��?\"Es�tH3����\\��0a��O�ϖ�;薲���3/F�\r+�M�E���miE�����ƾT��4��k�`q4�Q<S�M�$�g�\r�g�`�.�I>�:cx��LQ��\Z0\Z;N�!y^�����\"�<�X-�%���3lt���0��g�ֺˑ�w�P4�	C�͛���_~^AtK�ݜ���� �zuuq(�[��A���nҘ���)3��;�}2��g	�}7vl�MQH�PZ\nS��p����U>�g�� Af1t��R�o7}�6��F�q؋T���;8��T����(��t�ey��x�L�f_�N�Uv�wdF��W�٨�һS�ص�Cy�I�#G��\\d��[���������9�8\Z�7��ZLD[I�\Z�����7c�P��l�R���_N�<j�\nǼ7�u���^�CԳbU��\0�F9���8%�f:\n�a䂁�Y���tAɶU|��݂[��}���:Ԙ�?���4�w\\���ڥ�ׯ��_~Z�AG�H�@���`�#t�<���&�ы�S:�F+���slVֈ;G�z�%�!��\"t{wn��~���)�zz\0w����nN�6͇��oLGa���\Z\'L5�nzIF�\Z�Wq����N��\rW����<���\0\"h�,�\0�O\n?�i�@\r�z>�)�U��K\"�W;����7m�����?���+���+笙j�Sbj���w]�v�jv_鹥��*J�1��x�S?����~�_A��.��D8p�v�c/�����O5��`��˻�\\-�Tx��-]�jg@�}]�3� �2c�z`mj��f<Z�?n���w��)��aqJX�(lb�9�ש7�f�\Z$L5��d6�Jr(a���k��hB[8y�R�D8�7\08�=�3�EN�IN��g�f�7�XhJ�֛�cyܮ�p7�Ҁn8|��Ӄ�*yTp%=�8YAO��fb��uO=�^x��9nZ�F�����	S�pK5]?�đ�=�0Ռ�i��`���L�Wo;�}۴a��`����=\Z\'�5�y�q75Z��|\r��k�Տ!���ͷ���&�d8Z�`ܮM�i֔��B���<ͱ�κ��~�4��S3�?=�9}-ӓZ�� ��L�z:W�F����/����oި�\rq-��E���yi�#���<͢�ڏ�ub�kr\n�L�~67_#C\n�\'���6.+��h�p4���3��A0����֚6����\"Mq�I�깥z���4x�ߙ���z�[�SRw���2�ѹ�hTt흊����\0���͋BiS��%o�ۤ�+W����;v��q�gϞϭX�\n�z����|���އM)��au�Bՙ���uo�Su�����m��7�7%na��j�A�T�-�ޥ�z@��B��%L{[)v�o�M1a�n���F��2�n�K�B�c��7F7�ZQҦ1A(\n�v���\'̗�n:nYS�)���7i��!���/��$ԚX&GBS�M��\\(���H�*�U�p+2�\'�@4�b��}Z�#zߢ�j�m�j�L�����z�n��r�fU%����ńm>,�V4Huk��*�D7�6��R<�;!�@oW`�GRQں���6��0�H�\'}�冄&=Ί��P���~Q�g�����\r�(��MĚp7�ȝ�8=r��j\01\\e�ׂT��$�t+]A���2�\"h��RD$�35�)�=�����]QJ�TF�00E���)8Z�<W!�*䨄��s����mo|����f�9΋���.=aK��i2D������f/�w���	SMe7=���t����5���Cj�ʹ]�rn#�X�1�a4�/ХԂҮ�î�/4�ESh��n~���F+��Y{�t�MO��w�����R,8��vR*B�K\"JnJ�4�zn�~��5F5�����������\"���Z�I�I����8�D?߸�]�@��d��Ī:\\��m�w8xc8�~٧p�c��!���ʲ4Z!C�M�>�a�<�Z��L�v����O��w��q7S�qkN�V^�B�i5�[rKy��(��K�&[�0u#�&9��{��[v-5�cq�\'�qx�>Rf	ݚBo:J��S�Ӧ�I�Ẍ�b��r«m���(����\\S�V�̝9�ُ/\nhk��ǥ�f���9;b�v\']]�5W�5&w|\'w�n�w��q�nq���L���jݺ�$t���x���m�#,��}�u�Q�L7�M��.j�b�8��w,$ܰ/��</��k�L�6U��Ჲ��m�P��5$�ݦrt���6ֹ�%�q�Srg:N��W\Z�O�-�ק�v-wi8����z�n�i���֧��1��v�����C7=�7^ƒ}64,X5,\0���(,�z�V\r���tC�]ݻs+��1�eP=��3oq+��B`���\0fӔ�۲o�sKc.��N�I���ɽ,y��O2�w�j���{��o���4�h�Co&|	[hz���MOpX�Vrj+�JrQ��l-c���h��>��� �ڪ�\'\Z�r-�U�Y�X��U\0�N}���U\0O��5��mS�qMV��L�YJA��*�	S�A����}	4U�9Gܾ���[�e��ʈ���1\r���r�s\n���\Zs�6ƩF���g�.rJ�)�5����r��𸬬�ii��XX2�	��5�8�\n[z2ט�58b�a����mm�?o6T�d�Xy;�L5�M�C)�|���͸[��[\nds��I&n�sA7&��G7�R^u7�yI�VS]͟(?^�\\_���K\'�_=�I�B�T�6kt���%�N�r�75\0zun�4m\n�~���o���w���l<�٘�%�U8��<۝���X!�U�3�\0�]�Q�X�C�M;L��bO������Yn��ܭ���d�@����s7�+I�Lᆶ���?p�w�@A��r4=GD|��Yiz�j�i\n����ja�\n�\"u�z>`���ꉂ���ޡ��=5?�q�E��h�j5�K��RACe���18TA�K�#vc7�UyM5�M;���1�����j&L5\'�vJ�2����x�4C��+���� Tt�����ܩ����jE8�MZRC�V�npI�EGv{�zc���giݦ^X��,��]�+�0XCj\"Q�Y�Jd=3�ݒF1�1���c�^�^y�C��J�Y0���<�i�j��ֻ�FV͍��k��Tp\\�3����a	�\"��<�i�5/�������S�ȭn�n�\"q_��X��YL�����	\n�u���0�[\0m�@Yu��w���P��Zڃ�#���1�9���d�\n�K���m8p��㦂��ß:a�9 F�s ���ltsj���ՂH�	S=��R)��.+{䡇YV�X��Tz��xG\Z���j�\\G6g)�\"�aR�i� ��ɳc�@��K�B��UA����p��ج,��o]!er�ګ�/3w��|,\08u>�+�E7S�qӄ��J�\Z�2�G�ݜ�)!$L���]*��E7�,�9��P�a�aU��X0zc7%�i� �+�vl\r�\r��Y�\\�5E�M\nYC*g�q����#��i�t����o���H��O���%�~� �����E**�kB7��[��z�6��~5�����A��{6��(�������\0z4;L��1��@LS��{��ώq���//^��#^�A=�8Y�X��ן]yb�{`�9N�G�?b�T���]8uP��׀�dЍq7�����{����~�%���)s�=mӺE�_\\��	S�w��#�Ω,X���?���	O�5@G%����n��s�d|&�V��i�B �c�xt��kf=��\'�:�L�c88�^�1��H@h�C�MGa5˨��(�zA7�������z�,&L%wTy��\r��+Hi��qㄌN�{u��)���X�M}��e36�퍫�>\n�ɔ�wS8���Z��:l�Z����[�eem���T�^�p�8�=q��&��)����)w3�e����i�k����l��5�ؙꑳ܍�r�0���*0]�<�����e]$⎔Aǻ�>M5����E/�`��SݖҦX�g�XҏT��\Z\0��\0e{n�rssO������v��l�������oZ!2W�*L�_���_@ߐ���츶���t����i1p�^�bq�?�g���v0���`�N�T�NT��i4�=����od�f���bO�:�p�F�i��\0�0ۨ/�f�3�xr���ԶCb����1Rèy�iX�6l�y1Xf�M2����_N�a`�08nu5�7���Oq�2ˇj7O�\Z�\0�F�~�(��lЭԔ��u���j�[��(�\"8(8�\0���{0qJ��xP��s��\Z�\rٜ����X`�xu=] �)/���Qg�4B�\"�І��jjf`��6���@k�\\�<��+~G̃ۋ�mY�b�\Z|f��xS�qK��L󡔄��]��nׯ֩=SvyJ���J\\��#�k�a�)wq���+�\0*||\r覓\n�Gs�D�N��la�vz})$=�\r\\�:mjY�~�}v���GR\rm66 C.`�\n9�\0S��k�*߷�**��q����xͰ1�?�[kZ�w�k\ZO�L�_�Y�jM�n!���AIK׽��L�$y\r:L�+v��Y��A�rpM�?��P�^Ғ�@���h��Bo����/yK����1�6��\np\0��̝��0��7	��U�\Z�ʪ������n�S�D:܆e�9ΠGo���	SC����]kζ��|>�UГ�=����-�;tc��\Z �k4��D,l�.LS��YU!Ǌ��7Y`-_�Yr���3t�)�iX���M�2�.C� �K�U���e�{ߦ\r�-05����Nk7���?�y|]:]T�޲�7,�l�r�̟7�Q$L�:�1�~a��+A7�-��BU�P��U�T�n�T�����[�.���$=�ƣ�}�z3����g�r��E��4�`ivLBc)�$��ӣ��̕��˖,h�+?�~Z��l���!k�NZ�ʤg^!bV2��1����F|�G/3}��y.�&��7hQ���.i�I��`ed�[�L]Rv�F7�;��EV��oz�7J���ePh<cA���X���&��-_�����ȑ9vi���u��S�M�8�S6�\0�\r_/D�\":��;5�S�F8y͘j��ؤ-md��C�Հ�IZ�K�nl��gjP�뒲�.�\r�sD#05�|竷z���5�S�>&*�q�7�4�X*���zܮ`uv� �Gv�	pR�(�Ͽ��N�~��G�xX�a�q��+L1��M/4���q7s�q+ؤC�,��)�S��\\\n�I�r�q��43�ਬ��|�n��R��4��8�Kw�<|V�shKA7u����[��R;���lbA�_����;���?��qᘀ\ZY��j�X���\\���z���[�yثPy����;\"�&���f�l���LJ�m\r��wS\'.��v�J�-��M�0��@��b��7^�R�,���@wc�lVUȍ�ޘ�/�1z$_䞱�Y����=�F��Up�S��g���J�s��wMn\Z�`u���YS��J�*��>&�����LK�x�lu0��S�A��Aj�����Rà�n�[��	^����ǍtS��6�V��#لn�`��b/U�\0�[[Mj`(�ƊB�|_��<=�]�Ub�iy�W�n<q�J�P����R�h��T����b��h��P��\r���m�9�[�!w��7����/61�x;�U}�.i�I�eݒ{Y��z��\Z�ӗ�td�V����zS{s� e�.)d�9/���t\0��Л�B���Ɣ�)��$ZV��̉#�v�=gՋ/��hf�L�\0S8b����;l�/9��, �0��s?�p�BJ|���c�k2u�LS�|AIB�An�&�bg�z�R���w)��.1���7Q��>��7�2kUo�3�0?�X�n:�PTcHާ�ɤ.:�hiS�;�J5Bo��|6]!��E��PR*K��~\"gצ�A�6�\'%ll!0/\n�Ν���L5�/͔+sK����n���L�rh�t�s�0�tʟq�\\.�E7p��	 �q�{�]��f�[M���$�}#\n�5C7R����݋����y�81\ndm�ˋ��z��yA\\\\ܸ���W,p��9\0�S�h?�3�\"���>g��Xsܚp[��q\n�+�n�����B.\"Z)%��66kܞ�>SD�H�7�]vYbXG��d\rx2���#��f��m�C��8ۄV���ǉ��1mv�^�}n�r��P��u�[KϞ=�fe��skJ��<.����8���\Zg]�����}	|U��IH$,	���� �@�\"�U��V0�Ղ�BGY�1qf�\n3S:J�\"K�/�QY�5 �b%�\"PYE��Yok ɼ�~�~�gy��{��\r��_�ܜ{��{��몟<%B!e(�h��.w���bQ�Ӗm{�N7�\\�jWB\nFM+����t��\r��&N9,����p\'K����P���9�OF*N].Wh��K1�ڣ��V�`�_�\r�j�SZ���~0{�i��18�\nxi	lat0DY��j��-�n��H�ci�4�U��A��3�ڪLW��x\rk�\Z.C�>��ʒE��S]���X0,��4A�x�b[��Rt�I�iC�+X��Su)�YPvE�\ZU�5��p-�f=jԏ���A�M��o��+_$D1��rڔȐ�a�<Rp8C7�zSѮ�[���@i9=� �B�y0b�7#��ʕF	��Y��_J��73gy�+����i?�����>��ຖLc4pZ�wbo���8�OWW⣰T�`��Rs��@��n��RE=��tH��� rtc%Y��/�є�G�XGdS蛤���\r�Tq7�`��Ÿj�O�6 ��\\[����\'�|�sŠ�	F��|��p�\"ӕ�(,Q�f�}1�� Z���!��T^�B<��hwf�s��0Á!�Uxh]�Yb�^�	Z�MWt����j��YtcX��\'�d�RC��Iz�%�5�*)���a��\n@��xB	�A�y�ر6mB����\0��7{v�#�@?��U\"�+b���*�R��[6TV��U`\r�m�L��ǩ�4�*u۱#$��BrA.WUt;V^p#�װE7�\n����Ν;�&k��Yo�E�wC��2\0 t!�\r,��\rF��i���唰��҂Y�=�?tT�^qj{d�P[��|@4#|��jߥ����?�W���T�����(\'�\ZU=8���I�s\\:�TЭz̮ZB�XP\"�� T>���L7Q��;�YQϛ���BHA�nL�[�+8��A7���Të�\Z!������7z�G�NLl_.�6u)�~�7��Ů��w����*��w�)8���*��޳s�߷XK-f�Upp�nε?½f���Rj&�Qe�q���.��ѐBɟòԨ	)8��KB���ng�ME]	�3��f\0I\"����*fZ!!3�)�b�0��X�)���515_�D��Yo蟊^�2�A���r���SX�+QĀp�U�w=�N��s\\�5�R3Q�j�-���It�g��P�N7�[�Hj���5XT����K8�����c�QY(��xě��B�p�4�D���^6;��ey!=���d�Rpֶn�5]��q?�0�۶�m:�c\07����u�ȡ�d]���������6E)hk���h7�	~7�T^IH!=Ņ�%	v��3f�&���%^�A����Z�O�%aS������sզ.�Zgt�ӮY�@@�V�t��h^��A$���?/��B�����`�\r�#���[��L���	�VY�?�[C*�;#j&=�݂-LĨ��Ӎ�)K�h)|�n\rRp��� X^��9��F�BΑ�RN�K��3>�f,��6u�b�\r�\'��9q�Ob��+_�Μ_����\n�������	d`�΋Q]i�3�\n@Lĸ@�����&�9.�C�ge���}���2V�8��+�&�3��w���n#r1[����xGe�H�VX��R��XL��gޗs�X�`n(}�bA��/�V�Zj��u�M�y�C-ȝ����Q�q��YZ��6�����D���QG��풚�C��A��y�B�Bn�逩�V�T�n�nHڒ�\0*��&I��=��תR�e��i?n�fF��X`V%��b7�mc�����t�C��CXS_�0��y�J���bfbI{���M���ݎ����ʅ#!�hX��@kI:N�\\�tc&��p#r��\"r7V!P|3�(�,G�6tf,���a��xKz�T�B�\r?-�d�Ѳ����bݏٌ��\\�@�o\'�`s��5��\0R�C��[�?�}�M������QX�d4Q&K�E)��ME8�W��\Z��XA7%P�\0��[Ո\r�zӝN��\\eX,���څk�m��;�/�¦�VU$�i3r�~�c|��/�a�<O@F��>+:����AfN\rU�5t��^0��m�\r�ۤ�m��9.��QXxS_J��rU���~7g3݄�Bjjj��y<��!=��m��HU5\"DC��DFK�h�+�b�%��VHx�7^�1�/�����1W/],߲^�.\\��m�6�1Whf$3�OE��r�h,��C:�����L1����[.]m��֑��F<M	O�KC\n@�,%RPA��s�c�b��M�L�!t���`3�э��9DƷe��t��횆[!]0X�c\"զ,�XK�w�[�c�2�T�/��\n�Bވ���S�+�\0�\r�1:\r��	�\0�s�\"̱�\n�M��R:}�Ɠ�{���L��4�O\n���v�\n���dH�����wݶn/՜<u	S��-�YcԖ�nH{�e�Q�,��7�a�F��}�+ƍ��!�\"����y���Ҧ�/xy>�6�@,l]�]аЦ�v@�5�ͤ7gCtYj�3eX����!͸�z�Μ<�ځ�t��ְ��)��w�m�77�ntt�����3��f�Ճ{@�9�fZ!Yh�&�n�ވ�cx�<�1h�}j�\ZE���Y\Z;�fs\0����e�#���9o;�2;tH�t��+\'\r�^L�%�ao����|��[��L�j�� ���u$��c���CdX9�bܧ��e�;x+��5�Z���S7э�\\��$m�k�9%�\Z;+��?��cܐq/,Tݖ�k�����ǫ�����q\nY*���:CQ�V^��,3���G��B��N��it�����X\'KM9��b�D`G7�2UaS7��c��&4�P�z��\Z���*��.f��fw��Ze%R3�QXb��6��l�1�����*�QG��KJ�����*nU��C7E�y��֊\\p\Z�i�o�&�i�fV��Y�`yv+W���5�@��m���o�2�)@j#�$@�X�ec�#i�q|��+����ei�Q-���:����q�g��(wS������������Z_�t*�jM���q}k��S�;��u,]�T���\Z� ��8�v\\��\0!n*j���I��L�t;�E3p��x��*ŭ\nS��&�h6�H��\"y��C!ZN�	,�za�3�z/�źV� E4!!��N�:Էo|�-����e�P�@���#�s\\���L����6���I�QK�\Z$[W��N�>����7)F6�ٝ\nS��;��O���Zi]o�!2��)q��(N�C/=C�[\n5�����`���t;�lˆU?yJ[���@9���8�V����kד�ӓr7�,b.��2��� VЍ��D���.K\\o�nHڢE�\0@3�Y��:-`I�iC��]$~x��IY���������;�d`��iM�RoK��Vi/�J~z��M5K��;/�����;�oF��=�~[W��7m+$E��E��<3#J��L)��vV/edtE)7m�70jY�jkz\r�����9�{�n5\\��ΞE��+BH!\"Z\Z�--��@�Wf�F���t�\Z�P�[�s7Ӟ�8!��hx�@��te\Z�Q�^��Y�^��gZ�{�k�Q~�l5�\\��n:5X���*���)�1�Lu��.3#�����P�[+k�7��[(daB�����f��qf��ھn�Mp�p	{�K{���\r׭�}�n=q���U\nb\r��cbTN7���w�AL��\"��U�v�I�ޱ���\n5�7Aw�\\o\'�ЭV��[\0�Z�Qfǈe��K�>�6#�^hZ	7\'��=�G�s�!��Vݐ��E�`9R��5e�2�)�!�=�Y/�>iu�ӓE)74;Ũ@�{�f��G��~�Z+�,�&�Td&+��Z�d���;u@�����wfr�Lu�����9�\"�ZUk⇝}�<2�w�n`p��X��kRw���݂���\\�=�	����>����Ng�	�.�pG/ͣ�;g6G���<�׀���5bHr��d5��s݃��!�v���Qg��)l=�4�Ӛ�{���%�0=y���r1���U\n�������g��|���<��C7�<��3�<��3�<t��3�<���3�<��C7�<��kl&�����KJK����n�g�yfֺt钗�7��@w\n��F�w+.^���R�<��3k6<?Μ�F��]B7��j�̙+W��g�yf�=7}�5���s�e��3���&�X�̡�cQ`m�y�g�������JJK�������3Ϝ����9g0�n���x7�3�<s�B}���U��o��t�<�����%�VV��<��3��p�\\B7\'��3�<���*<t��3�<�\n�ܩ���3�<���3�<��-���b��y�Y[jj��*]�n���u\'zy�g��n�Δ�v@�8a�Y ��E��էe��ɂ���v�|.\'�\\S�cռi�WSaAANN�)�������R��Taa�sӧ5��?Ӽ���x�Kex~~^^�)�G������Iqq��S]�p��h�(�����{�ŖCp������L,�R]e�����%`f��{�띮�SX�FXEEEBRS�]F��k7�~�i�]�?�n=z����Տ��2�-��ʕf�{��>Ѐ7�����n>r��w�E�u���^�?n���?�ފ-%%���pbOL�L��_~q�[��0��#�X\\�\04�.�h~zF��X����@1���7}Hj�2)��yE�\n�s���U���m���^��3�\r9طX�كßl�`� }�,(����0�uk�DO�RS[ϙ=���,8L�o�	@��Ğ|fZ�N�f�����kj�;���K�kޒz9s���?�;\0h\0���7�9�~A�8��=&�%����|񕒋��������@%�騩��D*��ٹ����o��(�#yrݢ�����M�T���K�ۏ�n?��cF�>�xb*윗�����R��R���fǁC�ݻ���OHhz#)���;˷lԅ6�|���߹�+���EJb�Ь�C;�1�v��������\r{��\r���?�zrֳcG��݂7�⥚_)E>y�}��Bp��;�*#x��x��m?z�-S�|3���?zx4�\ZR����:c�L���+.}-S��[�F�>�Lr��6���y��-�³t�TV)�i~�j�.�`/_�)uw�Q���(\n,���<?�{�s�i�>/8�s�s�#{%�4t�ܫ��]�6���4y\\�ُ?жS�	%�睸EpLx�L~(wҸ���nË��O��3�~ى\r�/|��׾V�V�.��͇�7g��g�XQ�ڤB���СU\Z�����`YY9�O`n*��Cg�/�!�,��A�<�s�mզc��_W,_���g�n���aEN���o�1i��k�板�\\g�k׬�\r`e�̍��&���#?�ɇcnϝ�����R[�v�,�|⌍wg�����\"�D���=����КC��~�F$��X��O�!\Zhf���n�i٬w_�*ҙX�Q��p<���{�S-��\0�+e��=r������;��dU�x�6��W�/�o�c�w\'�S�kNF=t�Rg��/..胍\\i���o4�\nP��ήƊ�~�g��\'&���@��T�~?��3���UX9����k�5.X�q��\Z��yE1.K��F����B���|�Lܥ+*��\07�o��M�3g��#V�G콷?5�	�\\�r�%�3{��\0�`�َ#\\��O���Q\r�\\r��y�}�6��� p��Ô�\0w��ҵk֨^*N(�o�j�,�P�Y*G7�81(��rW�^<u�A[���\r�ֹ=�SJ�⋤�,�K\\d�x�ag�q���T���X@�����2�8�E ��O�GnHP���v��Z�i��z8+���#	�n[��̀��ӫ��2h���j��/��o���<˲T�Lk��S����rs1UV�	���8�-�{vuR��.k���v������@\n8�W5�25z���b�m��\r��ER�8�oD}z��Ew���;�/{�W�J)���.����˖qG�N�}��K�Yͅ+l�E�}sT�*�i͔��\'�r׀��lܸ/�G�O���u�rf�wn�Q�j;��ԆЍ�&�\n���}����Q��T��e=\0p<�$7 \\Ro.�A2[�%�Hm~�w��g\'��vp������bi(k��8\\���)OL3,���*���FT_��~�E�䫵�q�������8�KR���|QiJIG�z�M�, �|U_��R�)��=;h�8��[+L�Ź#gS��	Z��#�Z���ز�r�N1���-��������~p���.��DUFf:�tڄ�\nx\nݘ8�K1����\n\'�Whr�.����}��np�3�t�~��;�B�7��WVV�bvR��.�\"���ѭW���Xa��R�����4ܴ��z�s���]m��+{���y��oª*��?��	5כܨMLi��Z�$/�e�ԫg�H?v�F}�Cy��}�};����3jj�a簾�e蚽��֚(�9��$�Ȱ���[k��1Z	�����Y��/���Ȱ{jȃ�g��\r+��ny��DY�3\'�����F7�\0čΗ�o����춃e�����~�ҿX�{�n�j<�j)p�oO�T���~c�J�Qb�V��e?x���Aw�\"PaW`���1#������M������\rK�뒝z�!ڂ����J�v��~C����������FR��fF?7�b��_�~�|��r�4A�&���.F��\r��.3�F ��;@�c�� �� ��Rw4!�j�I᤻`-Q]�j�߀_rGܧ�(�,<4�С�D���@f�i���\'~�̈́���H�]��r��[�Y�d��č�݈��QOΒ:Afܞ�&������z�ի5�Ma�RRŌ�R�ȃ�f �r�d��;q��I���z�H:!��\\�ZV\"��z��r�6��s�)g+��~�w�ʡF{X��4��ٺ��R�����^��N�Wط*�\r��voߡw�zz�/V�P���s��%��[2U���֦C�3�g�u���w�K���g[��\\ ����M��!�bH�S-q�>m:����gmc���DM�궗o�#��o������,u��FE7���}\Z�).�1Qz��Ysx���y�VV�K`��aMUވYo=��A�����C��k����r��E$��Ҳ�rt�[0!�����c���YMP��������L��l��!_1�V���� �.��ߚ�+�U��K_���9���K>�����oĒ��\'�Y�8��-uuy�7�i�̍�\\�N�:��1��%�h������?�_y�����6���bf;.����%��&5K�r��,uC㉟�1�!B��x)��M,��f�sl��u��?�K���\r%�?��/������F��b�J��mo���W��]@�T��=��mo͛�B��EKF����8ɂ��\n��w�-�kW.�G��ʚ\'�x��ަn�n�\Z�n8�Y�C\nƲ42B]����)\"e���p�U�a��n$�����Yj�l�n�Oі\"Э4��+a+G�<�<v��]�\n�e�+W�hSm\'إ׫�^�<;r)�Vs�z\\��kk0��U�G��$�O�[�Ņ@(�����8ѽUy\ZE���߹��ce�e�F��V��b�4+�\n�f������߀�Y����oS]o�@Z|���,5�n@�m���)��o�^�ja��b��*��?3��.b����7Ov����z�]zht/��I8�d(�7�HZ�)\\�.�m��z䤙J��.z��_��Oq\0�����-W�R8��u��k�H�S��# ��J�GS��IT��Yj���l/z�9�D�\"MLa���V:��SV�&\r\\<Y�����E	�N��;׀�$�ft�UU�;ic:�H=�@���m\n�}�s�9mß�(S���ǯ���ɲ�	�co����̺,K͡����qڙ�z3+���m�m�,U�5�|��W�:�s\'��c\'׀��Vn�4=��75���OR��F����M�\0���\0\\\Z��xZ��_&�e�����W��R�3�i4����g�7���H���x����Jl\Z}�Q�0�ox�owb���4_�Jr�.��0�>��;Xpʹ)�\Z=`\n,���1�T:1F��s���SY��Z�*�,K�[ߎ��m��1\"ˌ��\"Ԋt�۩��\r#�;��w�W���T��@+ٍ&�\0��R|i܍�|ub�v�R��ң�����\0�T?�_�v��mI	��Vsi�f3��R\r�b蔏�R�����sb�B�s��Zw4��ooL\0�م;��pm���L/%P	�#��D�zv������Y(�rM��F7ũ	���`>�Y�}��W�R]�o�*�v)�S��ޓA�2�.$���V�\'˕\';;�b���Q>ֺ5u���\"SI7S�u\\�J�X`��n\"�Le`�A���\\\Z��S�[�N7}Y\Z8\Z~(�,=�i����Ԝ2�W���B�j�{N��?/٥�ӟ��bο�æ�!9,u��q��ޝkj��K��b\07��am\\��N����\0o�a*5�#}̖}�\"S%1A���I,k6���ɣF�K�t�J%\0��};?ôd��b�S�� KO�p�k���MYj\Zݘ8��\0��9�۹��49�;�>S�7��o�Ŀ\"z?��/X���ũ�+�)�iF�WD�3*��7e���j%����Q�(�$�t�u�i�\\��ȃ��M� T�Xt�@G�6I��\"���z�&-8ܔ����C�T����-�F^N/�gId�+S1��!]����ޖI���\Z�n&�I��ˡ�\Z\\��D�H�e݌\0�s.p�8���Բ�-�7���d-$�H��&ݖ�������V��ƴ^z^ȑ/*�V2���8CD:���Ӱ�O��	��]��t��#Y]��QN1�$����B�D�2�cԸP\\���J���n�3S9�X.S��Wj��oD��t���l�i��˲�\n�)�ENY^q�\'Cݐ�-���O���h��2��!a��ٍ�ެ�⨩�\\�;�J#1�&!лI\r�\nf�˃�*@%�(�^T��H���Ϥ�ݲ�,�E�/zm+PĎ,��n����B�3�\nԺ�TA/�?�?�Q�SSs�����ڝ=n�2��Y�\0(������+&�\n�4f�L�)�8���Yl�.���h@D�4\"�X:tm+�.��)�:(b�hs_�ZD7ũ�~!V]o�rz\0�v���̨bԅRK_]�i��~���\\S���:S\noݬ�Q���}GL�UE\'�&�PC6\'�.�)-�n�d�0� ��E�:=�@�<Zj*Ă��}Yj�l��~!,��������=��Rb���O��0o�Cy*��\n/�$����P$���\"�e���nHq(W�p�P�\0S��Q�p���y�)�Sr��#�beL�R��fkC$R��]���!�t����y`!z�r�*������ʜ`�\\|�*_����Z\\&V��ME����H���)��֡k;�0��!e�$u�\r\Z�)vZ5�J��d�ut�W+e�)n����̹��ӟ;��ҷ߮\\�h4��!�����]�}k���S�DtC:���qx�qƤjd/��]x��\0���)�by���,?T� ��D��zo��f#�4�/$���7�t��}�Fߧ�)�o N�ti�c��g,p��fi#Ly�\0D�	�JbƜ�`\rx�3l��o��-<G#K�J9�[�����t3�K��iit5d&��b������Q�PM�ga4@=T���r#rb9=��Xe�-���/�_JoW����Ӕ&S�t�#�\\\0�6�	J#1����[D�\\�T^X�lN��J�n�fѮy�x�Z�C�ƴ~@~Qp&w#`1�R)�r�OnC��bM�F�n6N��7>=pԵFl�rz��6z�>@��B�������\\GD�X8����`���d�[ӂ��.Z�\Z7#�%�Ta*ƔO��\0S�Lq�($��p�����Y<Z�H���8���7Xa�nH�Y�nJ���AzhK���EK-h��K߅�X!}C�ؼ,z;@v�km��e K^|�DJ��\r�k]�;�4\ZF�Ȑ=�\"$�,-!T΋G+o$�R;��M�4\"A���a�3%����?I��;i���葷�[~;� B���Q��,�VTr,L�����n�\Zm���,�DX�a�����D��C�?*`\":��,�֝خ�GN��f���̶\Zo@Y�X�����}��H����Q�wC*+/c�tVNo���Mq���s�1��\0Z\n�t�l������{�i�o-���΄yE�OYe&�|��5�ג�%��w4�H�r#�Á�h`������k�\\�I`�e��O�!����vd�d����1b�R.i4�T�pFR}��_��{�-S�~����d�|*�n�v��r�e�\r���t�\0g��܈�8�V6[-R�-fC����3�sxy�xO�nT�3��8D�?A����o5���w�s��t���~ٸaO�?��L�\n�K݆t��w��B�\'80,�wӲ����+|���Yz5\n�[�R;�[@��ȳ�����E_���}�ɝ?z��D���ç��5�ǒ��J,�yK��ǎ�d�����\0�����\r{)�uǱ�n���\0��ϖ�ڵ1�n�NjFf����;~�m\"q۸T=�^LvC@G�ujkTy��.BR�-��$W�N�jXY\Z���F�i\"/�\"؈ܔ�^NO����b\08�P��Nן>���5ng���&�Z�j���F�ws�F�۳.=M��Lf{aD�x�iDH�3��\n��y�7�ae�=�f_Z/)/���9�e�\'�?@d����X���W^N�DD~-�\\W�_�.�Ꚙ�<�3ƣ��B.٩Y�zr��-qS��)�\0S��0z��F��O,x�cC!C�r7�\"�ļx�9�\'��I�Y�(�IS�0��2�!j҃	\"1���u�ÊZ��w�<�E����ך�5�Go��C��H�\0%r��Q�#נ�?q�S�%b����]���ԛ���rz���t��O�L�4��&�4�Y�S��Ի�AȰ�7��G܄�)R�`�n�fL��N7U�Y�o��R���.\n��PԛmDn/w�w�t� ��%����밥�HYl�����*��\'\Z����ď�Y�\Z���e��C�n]�ҌZ銲T��.�_Z��opYjw�I�+�y#�ܑ�����;&�J-��`��;�^�\0`���m�����*�z��F+Hh�2���vuo�oN��BbS�ޘ:���.�uC�\nb�quk�-��P�e�r�f��R���.\"J�W��yqZ�e=piH!Ce[����>}p�8��葷�,U�=_�����Ẃ��[Ĵ�ܱ{�>1-�s����\rlݢ�h��<�����m�(`J��:��?R�e�|,7%�|7�z�O�R�\'���z�7;yӑ�Jf����sӧq�|���J\nBs��M	��L�ߕ����9��0�^��ߚ�h�OǏptY���)v�fbv���4�ή�Q���ᡫb�g����֟�T?u���ڐ�/��$�kBupL��E��o�\'��Fa���I�w��eU<�|ɉ��B�]�c��J�\0b���B����=\'o�Lg�͡O�7n\0�Kqt��T�b������z�wr A$�ٹ�����,|zĨ\'g�:���ux~��=�/���,����]��=t���\0j�fL���9µ Z[`�8����#��$\r�%�-˹,�af+��������B���X�\06q��X�IS�z|y�0^N�$%:�����I\\G+Rq��`��ȇ�\r�`�|���β\0�UU>�U�4r��f�D�d�A��5o:0hi$Qt�!��0���e�t��n�>�QV�ǈ,���1t[\\�X\0�n����moT�lD���S��x9}塳���$�yK+}/\0gg̜�b�2%P�\0�C�Gg��=��fM���?a9G�cz�\n9��fP�/����VF�yEcih�m����w�y���խA�11����lk錉���������v��r>Fd���tH)\'G��4TQ/mD��#�5\"�orj9�q_�&q�a�o� 	��r�v�+W��\\���~�gP���}�ܛnݢ�\Z$u�L=A�1ZO} ���Z}=���[P��M!��J�۸nk�l�`ף@B	�X]-	{3�M�B��v�فWΛ%n�#KmF7FJ��o�S��w�^�F���rK�����f�\'.�^�X�к��)S���\n\\���#����_\r�k�#O����۹�U��❺������A����\Zn6�Xj1�!�GC\n-�[]�TL���{�Ȑ����OPUΛ\r)Ď,���f)%�|�7؈<ό뭬��XNo�xS�|>�Ǝe�?toz���������S���w��z]�S����90��,+�~n-(S$�(Nzv�_T��f������R�·���\Z�\r��r>vd�����i�ay!!�e�n�	6\"�H9���M�hn����\0�pn�N�cF�qJ�5\'F<9��l\0M�\r9B����1�\"i����bx��\r����Zޘe���f5��M�/$@��t�2��ZV^F�O�6�Tj�,`�;g�4�V�ՁJ���Ytf��/Q�*h*/2�둓�[���#za\\@I6#w��������lH!�d�#��f^�?��<�*)	+_��~��`҉M,��ڙX�p�?��E�>��Z�N��9�&<�b�4�n�L����27Ya\0wJ���)Y���\"NY^��^�n?�)��it���`E���o&1ʲ�3_`�}����}�ysG�G��a-���n�2�7�x\Z�ܸ��r�]b#}��.qtSQH���dg\"���X�����]�{�(��[px9���M)��������}�=���/�G�`�5)pV���#�ּfFn;�^�a��v�3\'��TL����N7�V\"�nb��<�X��N��-��/�����D,��w�)��00�5;Q\n+mRXP��ê̹^�!e���rt;w���t3�ݣ0E2�z�]�t�Q\r��@�i>�h*�cM�:�nv�S�~<��	F4L-n�xS�x���,է�NCDmNϵ�ҷ���~��G�*&�n�p��\0S�ӭK�t^W`ԧ�)\\S�Ҳ�/K�B7[h*1/�Z7$�t��GC\rx{��-��o�.����R���y`����CC7QWZ�x�)f�����J1� ^qH %Ӎ\rf.5#Kom��foZ/%/ĉrzx�^����6��3g�_F���o�G�i2m��Wѳ�EZ�k���lkF*�U�\"�+8�TP��R�ȇ�\"\nW��7R�AY� ��\"N�y!��b5r���qr�>�J���fy�Ƽo@\nڹ�.cوE�N�R�&o��3\'�h�)eL������TT�f��bS�:�n��Ub^oDn��V\"��2��-���t>x� ~��,J`�p#Iy#�K���9��+��I�\Z,1� ��%�f�8�Xɶ�/H�Y7�,u�l!����	ͮ^5��T����08���F�eee���Gk���)�MD7D��8r���NX��YqR�`Uē\\d��+l�2���`�)q6���2T^zwS$�\r7�n\nY�,��\"N�y!g��w#���O�s��\\����Ν�ئ\r,8�|\\LMҸ3^��\n�C�xv��G�%B\n��i�ptc�VڌW�b��=�YY�,���p��v8.N���(����~��*�9�-\\��M���������ߗ�X�yVKZ]}C�A0��|QX��Pq���~��\0S��^��a_#H\n9�$�4��X[��x]B��)+5/䀕�Pb9�/O+��#B��)\n�s����T�O�\\�p�vl<��[+*�!XL���<�X,2%�a8$\\��`48h�C�va��aO��,m��Q�`2����qt��<����	e����/����{Y,8�]<J\0j\Z��*�#x(��3i�b��<���^)<�SOC���B��pb��ЂI�R{�	>;ݐ��L����˙���eY�8���ļ��{N0�Hw�Q+B��æ\"�r_ͅ+��J�0�L�XJ��d��[cʠ�UR1��ɨ�\0�:���g�����	����bcbd�n�f��,5��˲�\rt�Hj1/,�\\o�Z�R��a}�N$�[b|����=\'�dG�7�[�v䭏��6�1�,�c,�����H��\"����&���(2�\n��Ój�)e6���PH��e��o�4��\rt�E���#^���s����}�6��|eej�ۺ�X�$?�0\Z�(���Ɣ[��;w9����%��m��g=��[z�����kM�r3��n��?\ZE��bd�8�YL�Û�l;��\'x>������n��-\0/��,k�ȉ���p�q���1�[A��E�#��[2�w3���xr\'w�>ޮI�.c���S�},�.1�����3\"48a<`��Ga�����R��/�Rih���R���q*@�����^?/0Ո�XN��hsz�K=����M�[��u]o}������Ҭ}q�)��5�Ƨ,�o�o#�\r����}�^]�Ï=���*1�KE|�{�V�`{T��4\Z`*\n�hz�1睩�n7M����8�BЬ� ћYR���X*��>�����{;�ӷK�\0�mu_cs��P<nN\'7�5~8;ڿ��=�����O�z��q��{O�@�_�	m��</b���cDx���\")����KV9�2����}Y����b^�Q�w��^N˴Wj|Ƞ<��f�#��IY���)�˼�[:$v��w`����\\I�.��#��цr:Wj*^�?յ_/��ӊ	�����禝�x�4�y�]�(b\nK�MJ�]&K�?$\'_\"@g3K�n�8�۱K�t���+Kۧ5#�tF���e����i�-ݯ��[��ѳJ�T�Cd(��gL[�����X\Z�h����o3�BQ+W���=���tFI}�c���8�� �L�V���h]+f\nI���r�?�Ϥ!��?�-k��r��z�TQ��\rm�6S��Y@�_\r�nw�;#��������v��u��f�xV�Y|��͔��6w�^��B~�O�0UW@,���*����\\e�c���%������D\n������lv�:�v�]�hj�5zF\"1��Dų�c��7d��P�O+�rrH���\"SJ��\0��f�K�-�ڴ��K?)�x�8)�+��,u�l{J^��nH����5P�cN��EE\"�L~(�%�g�5q|��� ���k��\\���/\ne4��w�U�э�*2��q����֯wo	���A2���F!K]E��#���ވ�T�^�tz+����+W������\'�.յ���C��U�{�p�\"}�<�����f�I�G��+#dA���hf�\r7�m\\D(\n�v=�*����(�颥n��-�4L[�V��nH�#��-�ٳ��\\2t>|h)�9���@�N7I��,ċmA�>b�&M�\"�����-��v�Y����̋�q�eJ���c�Tp������G� �n��)\n��ny~k��Ut��y!���-��,q*3��?�������]z��Q��_f=s�l���mӕ@�{��Q�08��=3��I����	��s�縸���t�Rf3��2#���]-W�7��6�E/Ny���k��`7$��X�`Q�jF>/.*�Ӷ]|g\\�����F��EJs�\0�/͹��|�m\\�jL�*�o1~��E��͒8�<ܓ��rLZ��n��Mݍ��ݐ\"���6�r�x��%#���?2�ٌ��(Q����/h,�W__����6�v /�0�O�o���s|!5u���~:~�ț?�Ė���6�Om��y��|c��\"���śK�Mԥ{�G��w�+bЍ~�`�M��h�k�w�Sj���^�nb�}������j��W��X��}�[�]\rC҉�����S�~�*��X���Ks�6��,�	��O:T|�⒠��f�ʯ=���(�!n��֬�r�C����=�\"n�ط��h�(Ѝ�7Y�\"v`?\0��nHĝ	\\���{�_�4;�Տ/���~FQf����شeb�Ju�G�#W9�I5��=�|��//�����m��ݳ�//-���gg��īS\\��*k�Q������y�;N�(x�=Dt�!\'���5%tE�ƊN7�o�v�r���&� e_\\bu�F��&��n+S[od|G�p�	��^�\'�&2w\0nO���}�`����Ȫ���\'���iR\'�/�b+�L���7p�g��(�\Z����+*h{k�t��hv���� �a�g��Q}w4I�qg�*Qd#,6���\Z�,m\0��ȳؐҬ}~�9�p�݈��k�:�kʹ�\0p���&�+�pɁ�kjИ�M;�`��w6�i���,�Vv�q��q�~	߅kѿ�V���^�pR�8iW�𳨭�D����\r�Z�Ϣ<A��V^k�I9��g�w4�4P*۪��ˎ#�SI�<��C7��A�_��lbzgb)BވQ���������`:w�D��|�ؼ\"�WS��a�Y_i��p��uMl��p�gO5u�Q�I�UY:c\"�RA���3p\'��m�����%?Mjי���~��V���]z����a��w���P�J�{�Xgna��1u�Y��8w�F���\'���\0��[�\Z��+��R��	�O]|�-�) ��Z0�����܉�����p`v�\'H,˵rc����Um�(�p�#3m�g��3e6��dǂ+Iϝ<j����6*�d�v�n�1��+��J�z��X{�����WR�Q���Z������;g�ٳ=t#Y�k��g��h@���ǻrz�Tb+�/��g�5\n[�lY����D�����u�u�g1n�M�^بA\Z^�2�4y�X��g�Ŕ��fFz��\r��O] �3Ͼ&����v͚�{��\r~�y�YZaa��M�\Z��-�Ѝܢ����g1b�M��n��F\rmJ���D+++p�X/M�3�\Zкt�lC���-\"?���}s�̎���3�<�l��>پ�怶��n�|���%E����|>o�y��ƪ���>�q�7Jt�V\\����b�9�<��.P���SX(�n}�]`L�7@���A��g�Ec]��ߛ�J�y�g���x�x�g�y�g�y��g�y桛g�y晇n�y�g�y�g_c�?\0ئ/��\0\0\0\0IEND�B`�'),(3,'Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Nam pellentesque odio et elit. Nam lobortis sem suscipit sapien. Sed iaculis aliquam sapien. Maecenas ut lectus. Aenean fringilla massa et metus. Nam varius, sapien nec egestas feugiat, mi libero dignissim orci, id fermentum quam nisl quis risus. Phasellus libero justo, aliquet quis, pellentesque vitae, porttitor quis, orci. Maecenas sollicitudin. Donec bibendum, ante quis sodales fermentum, quam risus placerat pede, nec aliquam lorem odio sit amet nisi. Ut sem tellus, feugiat vitae, lobortis nec, dapibus at, est. Aenean cursus. Vivamus faucibus lectus eget felis. Nullam commodo tortor vitae turpis.\n\nSed mollis interdum risus. Pellentesque ante velit, facilisis vitae, fermentum eu, feugiat sit amet, dui. Suspendisse tempus ullamcorper nisl. Suspendisse ullamcorper, velit non luctus gravida, massa turpis ullamcorper eros, sed dictum risus neque ut augue. Vestibulum neque nulla, pretium fermentum, rutrum vehicula, pulvinar at, est. Quisque dignissim. Nullam placerat neque vel urna. Quisque cursus lacus rutrum tortor. Nunc ut elit. Vestibulum mi nunc, volutpat id, tempor ut, scelerisque vel, magna. Aenean nisl nulla, rutrum sit amet, sollicitudin sed, molestie eget, nisi. Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. In odio erat, bibendum eu, gravida nec, elementum sed, urna.\n\nAliquam ultricies viverra mi. Ut convallis urna quis urna. Sed sed tortor. Suspendisse quis tellus. Ut gravida. Ut facilisis lectus in purus. Sed at est non libero dignissim varius. Donec vestibulum odio ac felis. Duis interdum pellentesque nisl. Aenean leo. Curabitur lectus. Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Duis nisl ligula, elementum vitae, posuere eu, semper eget, augue. Maecenas metus nulla, ullamcorper id, malesuada sit amet, mattis nec, lacus. Nam tortor.\n\nNam sollicitudin, lacus sit amet aliquam tempus, nulla tellus tempus velit, eu sollicitudin dolor dui et velit. In ac sem. Mauris adipiscing enim in felis. Morbi porttitor laoreet sapien. Nam felis dolor, laoreet sed, iaculis eu, vulputate eu, nunc. Nullam egestas ligula. Fusce ut sapien. Aliquam erat volutpat. Proin tristique scelerisque sem. Nullam non erat.\n\nSed feugiat, lacus in elementum egestas, sapien nulla sodales leo, nec scelerisque diam eros eu arcu. Phasellus ut magna. Cras dignissim pellentesque tellus. Curabitur sapien. Suspendisse a risus lobortis quam consectetuer placerat. Aliquam ultricies pretium tortor. Aliquam erat volutpat. Mauris nunc. Etiam vitae diam. Aenean a felis. Donec posuere, lacus in lacinia commodo, ligula lectus rutrum nibh, non dapibus sapien enim eu mauris. Pellentesque arcu risus, condimentum id, dapibus in, blandit ut, pede. Nulla facilisi. Vestibulum elit quam, fringilla convallis, congue lacinia, dictum at, velit. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia Curae; Sed augue mauris, commodo vel, tincidunt hendrerit, consectetuer eu, eros. \n'),(4,'Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Nam pellentesque odio et elit. Nam lobortis sem suscipit sapien. Sed iaculis aliquam sapien. Maecenas ut lectus. Aenean fringilla massa et metus. Nam varius, sapien nec egestas feugiat, mi libero dignissim orci, id fermentum quam nisl quis risus. Phasellus libero justo, aliquet quis, pellentesque vitae, porttitor quis, orci. Maecenas sollicitudin. Donec bibendum, ante quis sodales fermentum, quam risus placerat pede, nec aliquam lorem odio sit amet nisi. Ut sem tellus, feugiat vitae, lobortis nec, dapibus at, est. Aenean cursus. Vivamus faucibus lectus eget felis. Nullam commodo tortor vitae turpis.\n\nSed mollis interdum risus. Pellentesque ante velit, facilisis vitae, fermentum eu, feugiat sit amet, dui. Suspendisse tempus ullamcorper nisl. Suspendisse ullamcorper, velit non luctus gravida, massa turpis ullamcorper eros, sed dictum risus neque ut augue. Vestibulum neque nulla, pretium fermentum, rutrum vehicula, pulvinar at, est. Quisque dignissim. Nullam placerat neque vel urna. Quisque cursus lacus rutrum tortor. Nunc ut elit. Vestibulum mi nunc, volutpat id, tempor ut, scelerisque vel, magna. Aenean nisl nulla, rutrum sit amet, sollicitudin sed, molestie eget, nisi. Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. In odio erat, bibendum eu, gravida nec, elementum sed, urna.\n\nAliquam ultricies viverra mi. Ut convallis urna quis urna. Sed sed tortor. Suspendisse quis tellus. Ut gravida. Ut facilisis lectus in purus. Sed at est non libero dignissim varius. Donec vestibulum odio ac felis. Duis interdum pellentesque nisl. Aenean leo. Curabitur lectus. Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Duis nisl ligula, elementum vitae, posuere eu, semper eget, augue. Maecenas metus nulla, ullamcorper id, malesuada sit amet, mattis nec, lacus. Nam tortor.\n\nNam sollicitudin, lacus sit amet aliquam tempus, nulla tellus tempus velit, eu sollicitudin dolor dui et velit. In ac sem. Mauris adipiscing enim in felis. Morbi porttitor laoreet sapien. Nam felis dolor, laoreet sed, iaculis eu, vulputate eu, nunc. Nullam egestas ligula. Fusce ut sapien. Aliquam erat volutpat. Proin tristique scelerisque sem. Nullam non erat.\n\nSed feugiat, lacus in elementum egestas, sapien nulla sodales leo, nec scelerisque diam eros eu arcu. Phasellus ut magna. Cras dignissim pellentesque tellus. Curabitur sapien. Suspendisse a risus lobortis quam consectetuer placerat. Aliquam ultricies pretium tortor. Aliquam erat volutpat. Mauris nunc. Etiam vitae diam. Aenean a felis. Donec posuere, lacus in lacinia commodo, ligula lectus rutrum nibh, non dapibus sapien enim eu mauris. Pellentesque arcu risus, condimentum id, dapibus in, blandit ut, pede. Nulla facilisi. Vestibulum elit quam, fringilla convallis, congue lacinia, dictum at, velit. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia Curae; Sed augue mauris, commodo vel, tincidunt hendrerit, consectetuer eu, eros. \n'),(5,'Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Nam pellentesque odio et elit. Nam lobortis sem suscipit sapien. Sed iaculis aliquam sapien. Maecenas ut lectus. Aenean fringilla massa et metus. Nam varius, sapien nec egestas feugiat, mi libero dignissim orci, id fermentum quam nisl quis risus. Phasellus libero justo, aliquet quis, pellentesque vitae, porttitor quis, orci. Maecenas sollicitudin. Donec bibendum, ante quis sodales fermentum, quam risus placerat pede, nec aliquam lorem odio sit amet nisi. Ut sem tellus, feugiat vitae, lobortis nec, dapibus at, est. Aenean cursus. Vivamus faucibus lectus eget felis. Nullam commodo tortor vitae turpis.\n\nSed mollis interdum risus. Pellentesque ante velit, facilisis vitae, fermentum eu, feugiat sit amet, dui. Suspendisse tempus ullamcorper nisl. Suspendisse ullamcorper, velit non luctus gravida, massa turpis ullamcorper eros, sed dictum risus neque ut augue. Vestibulum neque nulla, pretium fermentum, rutrum vehicula, pulvinar at, est. Quisque dignissim. Nullam placerat neque vel urna. Quisque cursus lacus rutrum tortor. Nunc ut elit. Vestibulum mi nunc, volutpat id, tempor ut, scelerisque vel, magna. Aenean nisl nulla, rutrum sit amet, sollicitudin sed, molestie eget, nisi. Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. In odio erat, bibendum eu, gravida nec, elementum sed, urna.\n\nAliquam ultricies viverra mi. Ut convallis urna quis urna. Sed sed tortor. Suspendisse quis tellus. Ut gravida. Ut facilisis lectus in purus. Sed at est non libero dignissim varius. Donec vestibulum odio ac felis. Duis interdum pellentesque nisl. Aenean leo. Curabitur lectus. Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Duis nisl ligula, elementum vitae, posuere eu, semper eget, augue. Maecenas metus nulla, ullamcorper id, malesuada sit amet, mattis nec, lacus. Nam tortor.\n\nNam sollicitudin, lacus sit amet aliquam tempus, nulla tellus tempus velit, eu sollicitudin dolor dui et velit. In ac sem. Mauris adipiscing enim in felis. Morbi porttitor laoreet sapien. Nam felis dolor, laoreet sed, iaculis eu, vulputate eu, nunc. Nullam egestas ligula. Fusce ut sapien. Aliquam erat volutpat. Proin tristique scelerisque sem. Nullam non erat.\n\nSed feugiat, lacus in elementum egestas, sapien nulla sodales leo, nec scelerisque diam eros eu arcu. Phasellus ut magna. Cras dignissim pellentesque tellus. Curabitur sapien. Suspendisse a risus lobortis quam consectetuer placerat. Aliquam ultricies pretium tortor. Aliquam erat volutpat. Mauris nunc. Etiam vitae diam. Aenean a felis. Donec posuere, lacus in lacinia commodo, ligula lectus rutrum nibh, non dapibus sapien enim eu mauris. Pellentesque arcu risus, condimentum id, dapibus in, blandit ut, pede. Nulla facilisi. Vestibulum elit quam, fringilla convallis, congue lacinia, dictum at, velit. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia Curae; Sed augue mauris, commodo vel, tincidunt hendrerit, consectetuer eu, eros. \n'),(6,'Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Nam pellentesque odio et elit. Nam lobortis sem suscipit sapien. Sed iaculis aliquam sapien. Maecenas ut lectus. Aenean fringilla massa et metus. Nam varius, sapien nec egestas feugiat, mi libero dignissim orci, id fermentum quam nisl quis risus. Phasellus libero justo, aliquet quis, pellentesque vitae, porttitor quis, orci. Maecenas sollicitudin. Donec bibendum, ante quis sodales fermentum, quam risus placerat pede, nec aliquam lorem odio sit amet nisi. Ut sem tellus, feugiat vitae, lobortis nec, dapibus at, est. Aenean cursus. Vivamus faucibus lectus eget felis. Nullam commodo tortor vitae turpis.\n\nSed mollis interdum risus. Pellentesque ante velit, facilisis vitae, fermentum eu, feugiat sit amet, dui. Suspendisse tempus ullamcorper nisl. Suspendisse ullamcorper, velit non luctus gravida, massa turpis ullamcorper eros, sed dictum risus neque ut augue. Vestibulum neque nulla, pretium fermentum, rutrum vehicula, pulvinar at, est. Quisque dignissim. Nullam placerat neque vel urna. Quisque cursus lacus rutrum tortor. Nunc ut elit. Vestibulum mi nunc, volutpat id, tempor ut, scelerisque vel, magna. Aenean nisl nulla, rutrum sit amet, sollicitudin sed, molestie eget, nisi. Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. In odio erat, bibendum eu, gravida nec, elementum sed, urna.\n\nAliquam ultricies viverra mi. Ut convallis urna quis urna. Sed sed tortor. Suspendisse quis tellus. Ut gravida. Ut facilisis lectus in purus. Sed at est non libero dignissim varius. Donec vestibulum odio ac felis. Duis interdum pellentesque nisl. Aenean leo. Curabitur lectus. Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Duis nisl ligula, elementum vitae, posuere eu, semper eget, augue. Maecenas metus nulla, ullamcorper id, malesuada sit amet, mattis nec, lacus. Nam tortor.\n\nNam sollicitudin, lacus sit amet aliquam tempus, nulla tellus tempus velit, eu sollicitudin dolor dui et velit. In ac sem. Mauris adipiscing enim in felis. Morbi porttitor laoreet sapien. Nam felis dolor, laoreet sed, iaculis eu, vulputate eu, nunc. Nullam egestas ligula. Fusce ut sapien. Aliquam erat volutpat. Proin tristique scelerisque sem. Nullam non erat.\n\nSed feugiat, lacus in elementum egestas, sapien nulla sodales leo, nec scelerisque diam eros eu arcu. Phasellus ut magna. Cras dignissim pellentesque tellus. Curabitur sapien. Suspendisse a risus lobortis quam consectetuer placerat. Aliquam ultricies pretium tortor. Aliquam erat volutpat. Mauris nunc. Etiam vitae diam. Aenean a felis. Donec posuere, lacus in lacinia commodo, ligula lectus rutrum nibh, non dapibus sapien enim eu mauris. Pellentesque arcu risus, condimentum id, dapibus in, blandit ut, pede. Nulla facilisi. Vestibulum elit quam, fringilla convallis, congue lacinia, dictum at, velit. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia Curae; Sed augue mauris, commodo vel, tincidunt hendrerit, consectetuer eu, eros. \n'),(7,'Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Nam pellentesque odio et elit. Nam lobortis sem suscipit sapien. Sed iaculis aliquam sapien. Maecenas ut lectus. Aenean fringilla massa et metus. Nam varius, sapien nec egestas feugiat, mi libero dignissim orci, id fermentum quam nisl quis risus. Phasellus libero justo, aliquet quis, pellentesque vitae, porttitor quis, orci. Maecenas sollicitudin. Donec bibendum, ante quis sodales fermentum, quam risus placerat pede, nec aliquam lorem odio sit amet nisi. Ut sem tellus, feugiat vitae, lobortis nec, dapibus at, est. Aenean cursus. Vivamus faucibus lectus eget felis. Nullam commodo tortor vitae turpis.\n\nSed mollis interdum risus. Pellentesque ante velit, facilisis vitae, fermentum eu, feugiat sit amet, dui. Suspendisse tempus ullamcorper nisl. Suspendisse ullamcorper, velit non luctus gravida, massa turpis ullamcorper eros, sed dictum risus neque ut augue. Vestibulum neque nulla, pretium fermentum, rutrum vehicula, pulvinar at, est. Quisque dignissim. Nullam placerat neque vel urna. Quisque cursus lacus rutrum tortor. Nunc ut elit. Vestibulum mi nunc, volutpat id, tempor ut, scelerisque vel, magna. Aenean nisl nulla, rutrum sit amet, sollicitudin sed, molestie eget, nisi. Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. In odio erat, bibendum eu, gravida nec, elementum sed, urna.\n\nAliquam ultricies viverra mi. Ut convallis urna quis urna. Sed sed tortor. Suspendisse quis tellus. Ut gravida. Ut facilisis lectus in purus. Sed at est non libero dignissim varius. Donec vestibulum odio ac felis. Duis interdum pellentesque nisl. Aenean leo. Curabitur lectus. Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Duis nisl ligula, elementum vitae, posuere eu, semper eget, augue. Maecenas metus nulla, ullamcorper id, malesuada sit amet, mattis nec, lacus. Nam tortor.\n\nNam sollicitudin, lacus sit amet aliquam tempus, nulla tellus tempus velit, eu sollicitudin dolor dui et velit. In ac sem. Mauris adipiscing enim in felis. Morbi porttitor laoreet sapien. Nam felis dolor, laoreet sed, iaculis eu, vulputate eu, nunc. Nullam egestas ligula. Fusce ut sapien. Aliquam erat volutpat. Proin tristique scelerisque sem. Nullam non erat.\n\nSed feugiat, lacus in elementum egestas, sapien nulla sodales leo, nec scelerisque diam eros eu arcu. Phasellus ut magna. Cras dignissim pellentesque tellus. Curabitur sapien. Suspendisse a risus lobortis quam consectetuer placerat. Aliquam ultricies pretium tortor. Aliquam erat volutpat. Mauris nunc. Etiam vitae diam. Aenean a felis. Donec posuere, lacus in lacinia commodo, ligula lectus rutrum nibh, non dapibus sapien enim eu mauris. Pellentesque arcu risus, condimentum id, dapibus in, blandit ut, pede. Nulla facilisi. Vestibulum elit quam, fringilla convallis, congue lacinia, dictum at, velit. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia Curae; Sed augue mauris, commodo vel, tincidunt hendrerit, consectetuer eu, eros. \n'),(8,'Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Nam pellentesque odio et elit. Nam lobortis sem suscipit sapien. Sed iaculis aliquam sapien. Maecenas ut lectus. Aenean fringilla massa et metus. Nam varius, sapien nec egestas feugiat, mi libero dignissim orci, id fermentum quam nisl quis risus. Phasellus libero justo, aliquet quis, pellentesque vitae, porttitor quis, orci. Maecenas sollicitudin. Donec bibendum, ante quis sodales fermentum, quam risus placerat pede, nec aliquam lorem odio sit amet nisi. Ut sem tellus, feugiat vitae, lobortis nec, dapibus at, est. Aenean cursus. Vivamus faucibus lectus eget felis. Nullam commodo tortor vitae turpis.\n\nSed mollis interdum risus. Pellentesque ante velit, facilisis vitae, fermentum eu, feugiat sit amet, dui. Suspendisse tempus ullamcorper nisl. Suspendisse ullamcorper, velit non luctus gravida, massa turpis ullamcorper eros, sed dictum risus neque ut augue. Vestibulum neque nulla, pretium fermentum, rutrum vehicula, pulvinar at, est. Quisque dignissim. Nullam placerat neque vel urna. Quisque cursus lacus rutrum tortor. Nunc ut elit. Vestibulum mi nunc, volutpat id, tempor ut, scelerisque vel, magna. Aenean nisl nulla, rutrum sit amet, sollicitudin sed, molestie eget, nisi. Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. In odio erat, bibendum eu, gravida nec, elementum sed, urna.\n\nAliquam ultricies viverra mi. Ut convallis urna quis urna. Sed sed tortor. Suspendisse quis tellus. Ut gravida. Ut facilisis lectus in purus. Sed at est non libero dignissim varius. Donec vestibulum odio ac felis. Duis interdum pellentesque nisl. Aenean leo. Curabitur lectus. Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Duis nisl ligula, elementum vitae, posuere eu, semper eget, augue. Maecenas metus nulla, ullamcorper id, malesuada sit amet, mattis nec, lacus. Nam tortor.\n\nNam sollicitudin, lacus sit amet aliquam tempus, nulla tellus tempus velit, eu sollicitudin dolor dui et velit. In ac sem. Mauris adipiscing enim in felis. Morbi porttitor laoreet sapien. Nam felis dolor, laoreet sed, iaculis eu, vulputate eu, nunc. Nullam egestas ligula. Fusce ut sapien. Aliquam erat volutpat. Proin tristique scelerisque sem. Nullam non erat.\n\nSed feugiat, lacus in elementum egestas, sapien nulla sodales leo, nec scelerisque diam eros eu arcu. Phasellus ut magna. Cras dignissim pellentesque tellus. Curabitur sapien. Suspendisse a risus lobortis quam consectetuer placerat. Aliquam ultricies pretium tortor. Aliquam erat volutpat. Mauris nunc. Etiam vitae diam. Aenean a felis. Donec posuere, lacus in lacinia commodo, ligula lectus rutrum nibh, non dapibus sapien enim eu mauris. Pellentesque arcu risus, condimentum id, dapibus in, blandit ut, pede. Nulla facilisi. Vestibulum elit quam, fringilla convallis, congue lacinia, dictum at, velit. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia Curae; Sed augue mauris, commodo vel, tincidunt hendrerit, consectetuer eu, eros. \n'),(9,'Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Nam pellentesque odio et elit. Nam lobortis sem suscipit sapien. Sed iaculis aliquam sapien. Maecenas ut lectus. Aenean fringilla massa et metus. Nam varius, sapien nec egestas feugiat, mi libero dignissim orci, id fermentum quam nisl quis risus. Phasellus libero justo, aliquet quis, pellentesque vitae, porttitor quis, orci. Maecenas sollicitudin. Donec bibendum, ante quis sodales fermentum, quam risus placerat pede, nec aliquam lorem odio sit amet nisi. Ut sem tellus, feugiat vitae, lobortis nec, dapibus at, est. Aenean cursus. Vivamus faucibus lectus eget felis. Nullam commodo tortor vitae turpis.\n\nSed mollis interdum risus. Pellentesque ante velit, facilisis vitae, fermentum eu, feugiat sit amet, dui. Suspendisse tempus ullamcorper nisl. Suspendisse ullamcorper, velit non luctus gravida, massa turpis ullamcorper eros, sed dictum risus neque ut augue. Vestibulum neque nulla, pretium fermentum, rutrum vehicula, pulvinar at, est. Quisque dignissim. Nullam placerat neque vel urna. Quisque cursus lacus rutrum tortor. Nunc ut elit. Vestibulum mi nunc, volutpat id, tempor ut, scelerisque vel, magna. Aenean nisl nulla, rutrum sit amet, sollicitudin sed, molestie eget, nisi. Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. In odio erat, bibendum eu, gravida nec, elementum sed, urna.\n\nAliquam ultricies viverra mi. Ut convallis urna quis urna. Sed sed tortor. Suspendisse quis tellus. Ut gravida. Ut facilisis lectus in purus. Sed at est non libero dignissim varius. Donec vestibulum odio ac felis. Duis interdum pellentesque nisl. Aenean leo. Curabitur lectus. Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Duis nisl ligula, elementum vitae, posuere eu, semper eget, augue. Maecenas metus nulla, ullamcorper id, malesuada sit amet, mattis nec, lacus. Nam tortor.\n\nNam sollicitudin, lacus sit amet aliquam tempus, nulla tellus tempus velit, eu sollicitudin dolor dui et velit. In ac sem. Mauris adipiscing enim in felis. Morbi porttitor laoreet sapien. Nam felis dolor, laoreet sed, iaculis eu, vulputate eu, nunc. Nullam egestas ligula. Fusce ut sapien. Aliquam erat volutpat. Proin tristique scelerisque sem. Nullam non erat.\n\nSed feugiat, lacus in elementum egestas, sapien nulla sodales leo, nec scelerisque diam eros eu arcu. Phasellus ut magna. Cras dignissim pellentesque tellus. Curabitur sapien. Suspendisse a risus lobortis quam consectetuer placerat. Aliquam ultricies pretium tortor. Aliquam erat volutpat. Mauris nunc. Etiam vitae diam. Aenean a felis. Donec posuere, lacus in lacinia commodo, ligula lectus rutrum nibh, non dapibus sapien enim eu mauris. Pellentesque arcu risus, condimentum id, dapibus in, blandit ut, pede. Nulla facilisi. Vestibulum elit quam, fringilla convallis, congue lacinia, dictum at, velit. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia Curae; Sed augue mauris, commodo vel, tincidunt hendrerit, consectetuer eu, eros. \n'),(10,'Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Nam pellentesque odio et elit. Nam lobortis sem suscipit sapien. Sed iaculis aliquam sapien. Maecenas ut lectus. Aenean fringilla massa et metus. Nam varius, sapien nec egestas feugiat, mi libero dignissim orci, id fermentum quam nisl quis risus. Phasellus libero justo, aliquet quis, pellentesque vitae, porttitor quis, orci. Maecenas sollicitudin. Donec bibendum, ante quis sodales fermentum, quam risus placerat pede, nec aliquam lorem odio sit amet nisi. Ut sem tellus, feugiat vitae, lobortis nec, dapibus at, est. Aenean cursus. Vivamus faucibus lectus eget felis. Nullam commodo tortor vitae turpis.\n\nSed mollis interdum risus. Pellentesque ante velit, facilisis vitae, fermentum eu, feugiat sit amet, dui. Suspendisse tempus ullamcorper nisl. Suspendisse ullamcorper, velit non luctus gravida, massa turpis ullamcorper eros, sed dictum risus neque ut augue. Vestibulum neque nulla, pretium fermentum, rutrum vehicula, pulvinar at, est. Quisque dignissim. Nullam placerat neque vel urna. Quisque cursus lacus rutrum tortor. Nunc ut elit. Vestibulum mi nunc, volutpat id, tempor ut, scelerisque vel, magna. Aenean nisl nulla, rutrum sit amet, sollicitudin sed, molestie eget, nisi. Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. In odio erat, bibendum eu, gravida nec, elementum sed, urna.\n\nAliquam ultricies viverra mi. Ut convallis urna quis urna. Sed sed tortor. Suspendisse quis tellus. Ut gravida. Ut facilisis lectus in purus. Sed at est non libero dignissim varius. Donec vestibulum odio ac felis. Duis interdum pellentesque nisl. Aenean leo. Curabitur lectus. Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Duis nisl ligula, elementum vitae, posuere eu, semper eget, augue. Maecenas metus nulla, ullamcorper id, malesuada sit amet, mattis nec, lacus. Nam tortor.\n\nNam sollicitudin, lacus sit amet aliquam tempus, nulla tellus tempus velit, eu sollicitudin dolor dui et velit. In ac sem. Mauris adipiscing enim in felis. Morbi porttitor laoreet sapien. Nam felis dolor, laoreet sed, iaculis eu, vulputate eu, nunc. Nullam egestas ligula. Fusce ut sapien. Aliquam erat volutpat. Proin tristique scelerisque sem. Nullam non erat.\n\nSed feugiat, lacus in elementum egestas, sapien nulla sodales leo, nec scelerisque diam eros eu arcu. Phasellus ut magna. Cras dignissim pellentesque tellus. Curabitur sapien. Suspendisse a risus lobortis quam consectetuer placerat. Aliquam ultricies pretium tortor. Aliquam erat volutpat. Mauris nunc. Etiam vitae diam. Aenean a felis. Donec posuere, lacus in lacinia commodo, ligula lectus rutrum nibh, non dapibus sapien enim eu mauris. Pellentesque arcu risus, condimentum id, dapibus in, blandit ut, pede. Nulla facilisi. Vestibulum elit quam, fringilla convallis, congue lacinia, dictum at, velit. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia Curae; Sed augue mauris, commodo vel, tincidunt hendrerit, consectetuer eu, eros. \n'),(11,'Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Nam pellentesque odio et elit. Nam lobortis sem suscipit sapien. Sed iaculis aliquam sapien. Maecenas ut lectus. Aenean fringilla massa et metus. Nam varius, sapien nec egestas feugiat, mi libero dignissim orci, id fermentum quam nisl quis risus. Phasellus libero justo, aliquet quis, pellentesque vitae, porttitor quis, orci. Maecenas sollicitudin. Donec bibendum, ante quis sodales fermentum, quam risus placerat pede, nec aliquam lorem odio sit amet nisi. Ut sem tellus, feugiat vitae, lobortis nec, dapibus at, est. Aenean cursus. Vivamus faucibus lectus eget felis. Nullam commodo tortor vitae turpis.\n\nSed mollis interdum risus. Pellentesque ante velit, facilisis vitae, fermentum eu, feugiat sit amet, dui. Suspendisse tempus ullamcorper nisl. Suspendisse ullamcorper, velit non luctus gravida, massa turpis ullamcorper eros, sed dictum risus neque ut augue. Vestibulum neque nulla, pretium fermentum, rutrum vehicula, pulvinar at, est. Quisque dignissim. Nullam placerat neque vel urna. Quisque cursus lacus rutrum tortor. Nunc ut elit. Vestibulum mi nunc, volutpat id, tempor ut, scelerisque vel, magna. Aenean nisl nulla, rutrum sit amet, sollicitudin sed, molestie eget, nisi. Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. In odio erat, bibendum eu, gravida nec, elementum sed, urna.\n\nAliquam ultricies viverra mi. Ut convallis urna quis urna. Sed sed tortor. Suspendisse quis tellus. Ut gravida. Ut facilisis lectus in purus. Sed at est non libero dignissim varius. Donec vestibulum odio ac felis. Duis interdum pellentesque nisl. Aenean leo. Curabitur lectus. Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Duis nisl ligula, elementum vitae, posuere eu, semper eget, augue. Maecenas metus nulla, ullamcorper id, malesuada sit amet, mattis nec, lacus. Nam tortor.\n\nNam sollicitudin, lacus sit amet aliquam tempus, nulla tellus tempus velit, eu sollicitudin dolor dui et velit. In ac sem. Mauris adipiscing enim in felis. Morbi porttitor laoreet sapien. Nam felis dolor, laoreet sed, iaculis eu, vulputate eu, nunc. Nullam egestas ligula. Fusce ut sapien. Aliquam erat volutpat. Proin tristique scelerisque sem. Nullam non erat.\n\nSed feugiat, lacus in elementum egestas, sapien nulla sodales leo, nec scelerisque diam eros eu arcu. Phasellus ut magna. Cras dignissim pellentesque tellus. Curabitur sapien. Suspendisse a risus lobortis quam consectetuer placerat. Aliquam ultricies pretium tortor. Aliquam erat volutpat. Mauris nunc. Etiam vitae diam. Aenean a felis. Donec posuere, lacus in lacinia commodo, ligula lectus rutrum nibh, non dapibus sapien enim eu mauris. Pellentesque arcu risus, condimentum id, dapibus in, blandit ut, pede. Nulla facilisi. Vestibulum elit quam, fringilla convallis, congue lacinia, dictum at, velit. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia Curae; Sed augue mauris, commodo vel, tincidunt hendrerit, consectetuer eu, eros. \n'),(12,'Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Nam pellentesque odio et elit. Nam lobortis sem suscipit sapien. Sed iaculis aliquam sapien. Maecenas ut lectus. Aenean fringilla massa et metus. Nam varius, sapien nec egestas feugiat, mi libero dignissim orci, id fermentum quam nisl quis risus. Phasellus libero justo, aliquet quis, pellentesque vitae, porttitor quis, orci. Maecenas sollicitudin. Donec bibendum, ante quis sodales fermentum, quam risus placerat pede, nec aliquam lorem odio sit amet nisi. Ut sem tellus, feugiat vitae, lobortis nec, dapibus at, est. Aenean cursus. Vivamus faucibus lectus eget felis. Nullam commodo tortor vitae turpis.\n\nSed mollis interdum risus. Pellentesque ante velit, facilisis vitae, fermentum eu, feugiat sit amet, dui. Suspendisse tempus ullamcorper nisl. Suspendisse ullamcorper, velit non luctus gravida, massa turpis ullamcorper eros, sed dictum risus neque ut augue. Vestibulum neque nulla, pretium fermentum, rutrum vehicula, pulvinar at, est. Quisque dignissim. Nullam placerat neque vel urna. Quisque cursus lacus rutrum tortor. Nunc ut elit. Vestibulum mi nunc, volutpat id, tempor ut, scelerisque vel, magna. Aenean nisl nulla, rutrum sit amet, sollicitudin sed, molestie eget, nisi. Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. In odio erat, bibendum eu, gravida nec, elementum sed, urna.\n\nAliquam ultricies viverra mi. Ut convallis urna quis urna. Sed sed tortor. Suspendisse quis tellus. Ut gravida. Ut facilisis lectus in purus. Sed at est non libero dignissim varius. Donec vestibulum odio ac felis. Duis interdum pellentesque nisl. Aenean leo. Curabitur lectus. Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Duis nisl ligula, elementum vitae, posuere eu, semper eget, augue. Maecenas metus nulla, ullamcorper id, malesuada sit amet, mattis nec, lacus. Nam tortor.\n\nNam sollicitudin, lacus sit amet aliquam tempus, nulla tellus tempus velit, eu sollicitudin dolor dui et velit. In ac sem. Mauris adipiscing enim in felis. Morbi porttitor laoreet sapien. Nam felis dolor, laoreet sed, iaculis eu, vulputate eu, nunc. Nullam egestas ligula. Fusce ut sapien. Aliquam erat volutpat. Proin tristique scelerisque sem. Nullam non erat.\n\nSed feugiat, lacus in elementum egestas, sapien nulla sodales leo, nec scelerisque diam eros eu arcu. Phasellus ut magna. Cras dignissim pellentesque tellus. Curabitur sapien. Suspendisse a risus lobortis quam consectetuer placerat. Aliquam ultricies pretium tortor. Aliquam erat volutpat. Mauris nunc. Etiam vitae diam. Aenean a felis. Donec posuere, lacus in lacinia commodo, ligula lectus rutrum nibh, non dapibus sapien enim eu mauris. Pellentesque arcu risus, condimentum id, dapibus in, blandit ut, pede. Nulla facilisi. Vestibulum elit quam, fringilla convallis, congue lacinia, dictum at, velit. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia Curae; Sed augue mauris, commodo vel, tincidunt hendrerit, consectetuer eu, eros. \n');
/*!40000 ALTER TABLE `test_attachment_data` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `test_attachments`
--

DROP TABLE IF EXISTS `test_attachments`;
CREATE TABLE `test_attachments` (
  `attachment_id` int(11) NOT NULL auto_increment,
  `submitter_id` mediumint(9) NOT NULL,
  `description` mediumtext,
  `filename` mediumtext,
  `creation_ts` datetime NOT NULL,
  `mime_type` varchar(100) NOT NULL,
  PRIMARY KEY  (`attachment_id`),
  KEY `test_attachments_submitter_idx` (`submitter_id`)
) ENGINE=MyISAM AUTO_INCREMENT=13 DEFAULT CHARSET=utf8;

--
-- Dumping data for table `test_attachments`
--

LOCK TABLES `test_attachments` WRITE;
/*!40000 ALTER TABLE `test_attachments` DISABLE KEYS */;
INSERT INTO `test_attachments` VALUES (1,1,'PUBLIC PLAN ATTACHMENT ASCII','LOREM.TXT','2008-05-01 16:54:37','text/plain'),(2,1,'PUBLIC PLAN ATTACHMENT BINARY','testopia_city_512.png','2008-05-01 16:56:44','image/png'),(3,1,'Attachment','LOREM.TXT','2008-05-02 14:20:00','text/plain'),(4,1,'Attachment','LOREM.TXT','2008-05-02 14:20:08','text/plain'),(5,1,'Attachment','LOREM.TXT','2008-05-02 14:20:12','text/plain'),(6,1,'Attachment','LOREM.TXT','2008-05-02 14:20:20','text/plain'),(7,1,'Attachment','LOREM.TXT','2008-05-02 14:20:23','text/plain'),(8,1,'Attachment','LOREM.TXT','2008-05-02 14:20:26','text/plain'),(9,1,'Attachment','LOREM.TXT','2008-05-02 14:20:36','text/plain'),(10,1,'Attachment','LOREM.TXT','2008-05-02 14:21:02','text/plain'),(11,1,'Attachment','LOREM.TXT','2008-05-02 14:21:06','text/plain'),(12,1,'Attachment','LOREM.TXT','2008-05-02 14:21:14','text/plain');
/*!40000 ALTER TABLE `test_attachments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `test_builds`
--

DROP TABLE IF EXISTS `test_builds`;
CREATE TABLE `test_builds` (
  `build_id` int(11) NOT NULL auto_increment,
  `product_id` smallint(6) NOT NULL,
  `milestone` varchar(20) default NULL,
  `name` varchar(255) default NULL,
  `description` text,
  `isactive` tinyint(4) NOT NULL default '1',
  PRIMARY KEY  (`build_id`),
  UNIQUE KEY `build_prod_idx` (`build_id`,`product_id`),
  UNIQUE KEY `build_product_id_name_idx` (`product_id`,`name`),
  KEY `build_name_idx` (`name`),
  KEY `build_milestone_idx` (`milestone`)
) ENGINE=MyISAM AUTO_INCREMENT=9 DEFAULT CHARSET=utf8;

--
-- Dumping data for table `test_builds`
--

LOCK TABLES `test_builds` WRITE;
/*!40000 ALTER TABLE `test_builds` DISABLE KEYS */;
INSERT INTO `test_builds` VALUES (1,2,'PRIVATE M1','PRIVATE ACTIVE BUILD 1','Private Visible Build',1),(2,2,'PRIVATE M1','PRIVATE INACTIVE BUILD','Private Visible Build',0),(3,3,'PARTNER M1','PARTNER ACTIVE BUILD 1','Partner Visible Build',1),(4,1,'PUBLIC M1','PUBLIC ACTIVE BUILD 1','Publicly Visible Build',1),(5,1,'PUBLIC M1','PUBLIC INACTIVE BUILD','Publicly Visible Build',0),(6,3,'PARTNER M1','PARTNER INACTIVE BUILD','Partner Visible Build',1);
/*!40000 ALTER TABLE `test_builds` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `test_case_activity`
--

DROP TABLE IF EXISTS `test_case_activity`;
CREATE TABLE `test_case_activity` (
  `case_id` int(11) NOT NULL,
  `fieldid` smallint(6) NOT NULL,
  `who` mediumint(9) NOT NULL,
  `changed` datetime NOT NULL,
  `oldvalue` mediumtext,
  `newvalue` mediumtext,
  KEY `case_activity_case_id_idx` (`case_id`),
  KEY `case_activity_who_idx` (`who`),
  KEY `case_activity_when_idx` (`changed`),
  KEY `case_activity_field_idx` (`fieldid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Dumping data for table `test_case_activity`
--

LOCK TABLES `test_case_activity` WRITE;
/*!40000 ALTER TABLE `test_case_activity` DISABLE KEYS */;
INSERT INTO `test_case_activity` VALUES (2,6,1,'2008-05-01 17:07:15','1','2'),(2,7,1,'2008-05-01 17:07:31','PUBLIC TEST CASE 1 - PROPOSED','PUBLIC TEST CASE 1 - DISABLED'),(2,4,1,'2008-05-01 17:07:40','1','3'),(3,7,1,'2008-05-01 17:18:05','PUBLIC TEST CASE 1 - PROPOSED','PUBLIC TEST CASE 1 - CONFIRMED'),(4,7,1,'2008-05-01 17:18:10','PUBLIC TEST CASE - CONFIRMED','PUBLIC TEST CASE 2 - CONFIRMED'),(3,4,1,'2008-05-01 17:18:23','1','2');
/*!40000 ALTER TABLE `test_case_activity` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `test_case_attachments`
--

DROP TABLE IF EXISTS `test_case_attachments`;
CREATE TABLE `test_case_attachments` (
  `attachment_id` int(11) NOT NULL,
  `case_id` int(11) NOT NULL,
  `case_run_id` int(11) default NULL,
  KEY `test_case_attachments_primary_idx` (`attachment_id`),
  KEY `attachment_case_id_idx` (`case_id`),
  KEY `attachment_caserun_id_idx` (`case_run_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Dumping data for table `test_case_attachments`
--

LOCK TABLES `test_case_attachments` WRITE;
/*!40000 ALTER TABLE `test_case_attachments` DISABLE KEYS */;
INSERT INTO `test_case_attachments` VALUES (3,6,NULL),(4,7,NULL),(5,8,NULL),(6,9,NULL),(7,10,NULL),(8,11,NULL),(9,12,NULL),(10,13,NULL),(11,14,NULL),(12,15,NULL);
/*!40000 ALTER TABLE `test_case_attachments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `test_case_bugs`
--

DROP TABLE IF EXISTS `test_case_bugs`;
CREATE TABLE `test_case_bugs` (
  `bug_id` mediumint(9) NOT NULL,
  `case_run_id` int(11) default NULL,
  `case_id` int(11) NOT NULL,
  KEY `case_bugs_bug_id_idx` (`bug_id`),
  KEY `case_bugs_case_id_idx` (`case_id`),
  KEY `case_bugs_case_run_id_idx` (`case_run_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Dumping data for table `test_case_bugs`
--

LOCK TABLES `test_case_bugs` WRITE;
/*!40000 ALTER TABLE `test_case_bugs` DISABLE KEYS */;
INSERT INTO `test_case_bugs` VALUES (2,2,5);
/*!40000 ALTER TABLE `test_case_bugs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `test_case_categories`
--

DROP TABLE IF EXISTS `test_case_categories`;
CREATE TABLE `test_case_categories` (
  `category_id` smallint(6) NOT NULL auto_increment,
  `product_id` smallint(6) NOT NULL,
  `name` varchar(240) NOT NULL,
  `description` mediumtext,
  PRIMARY KEY  (`category_id`),
  UNIQUE KEY `category_product_id_name_idx` (`product_id`,`name`),
  UNIQUE KEY `category_product_idx` (`category_id`,`product_id`),
  KEY `category_name_idx_v2` (`name`)
) ENGINE=MyISAM AUTO_INCREMENT=7 DEFAULT CHARSET=utf8;

--
-- Dumping data for table `test_case_categories`
--

LOCK TABLES `test_case_categories` WRITE;
/*!40000 ALTER TABLE `test_case_categories` DISABLE KEYS */;
INSERT INTO `test_case_categories` VALUES (1,1,'PUBLIC CATEGORY 1','PUBLIC CATEGORY'),(2,2,'PRIVATE CATEGORY 1','PRIVATE CATEGORY'),(3,3,'PARTNER CATEGORY 1','PARTNER CATEGORY'),(4,3,'PARTNER CATEGORY 2','PARTNER CATEGORY'),(5,2,'PRIVATE CATEGORY 2','PRIVATE CATEOGRY'),(6,1,'PUBLIC CATEGORY 2','PUBLIC CATEGORY');
/*!40000 ALTER TABLE `test_case_categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `test_case_components`
--

DROP TABLE IF EXISTS `test_case_components`;
CREATE TABLE `test_case_components` (
  `case_id` int(11) NOT NULL,
  `component_id` smallint(6) NOT NULL,
  UNIQUE KEY `components_case_id_idx` (`case_id`,`component_id`),
  KEY `components_component_id_idx` (`component_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Dumping data for table `test_case_components`
--

LOCK TABLES `test_case_components` WRITE;
/*!40000 ALTER TABLE `test_case_components` DISABLE KEYS */;
INSERT INTO `test_case_components` VALUES (5,1),(6,3),(7,3),(8,3),(9,3),(10,3),(11,3),(12,3),(13,3),(14,3),(15,3),(16,4),(17,4),(18,4),(19,4),(20,4),(21,4),(22,4),(23,4),(24,4);
/*!40000 ALTER TABLE `test_case_components` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `test_case_dependencies`
--

DROP TABLE IF EXISTS `test_case_dependencies`;
CREATE TABLE `test_case_dependencies` (
  `dependson` int(11) NOT NULL,
  `blocked` int(11) NOT NULL,
  UNIQUE KEY `case_dependencies_primary_idx` (`dependson`,`blocked`),
  KEY `case_dependencies_blocked_idx` (`blocked`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Dumping data for table `test_case_dependencies`
--

LOCK TABLES `test_case_dependencies` WRITE;
/*!40000 ALTER TABLE `test_case_dependencies` DISABLE KEYS */;
/*!40000 ALTER TABLE `test_case_dependencies` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `test_case_plans`
--

DROP TABLE IF EXISTS `test_case_plans`;
CREATE TABLE `test_case_plans` (
  `plan_id` int(11) NOT NULL,
  `case_id` int(11) NOT NULL,
  UNIQUE KEY `test_case_plans_primary_idx` (`plan_id`,`case_id`),
  KEY `test_case_plans_case_idx` (`case_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Dumping data for table `test_case_plans`
--

LOCK TABLES `test_case_plans` WRITE;
/*!40000 ALTER TABLE `test_case_plans` DISABLE KEYS */;
INSERT INTO `test_case_plans` VALUES (1,1),(1,2),(1,3),(1,4),(1,5),(2,6),(2,7),(2,8),(2,9),(2,10),(2,11),(2,12),(2,13),(2,14),(2,15),(3,16),(3,17),(3,18),(3,19),(3,20),(3,21),(3,22),(3,23),(3,24);
/*!40000 ALTER TABLE `test_case_plans` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `test_case_run_status`
--

DROP TABLE IF EXISTS `test_case_run_status`;
CREATE TABLE `test_case_run_status` (
  `case_run_status_id` smallint(6) NOT NULL auto_increment,
  `name` varchar(20) default NULL,
  `sortkey` int(11) default NULL,
  `description` text,
  PRIMARY KEY  (`case_run_status_id`)
) ENGINE=MyISAM AUTO_INCREMENT=7 DEFAULT CHARSET=utf8;

--
-- Dumping data for table `test_case_run_status`
--

LOCK TABLES `test_case_run_status` WRITE;
/*!40000 ALTER TABLE `test_case_run_status` DISABLE KEYS */;
INSERT INTO `test_case_run_status` VALUES (1,'IDLE',1,NULL),(2,'PASSED',2,NULL),(3,'FAILED',3,NULL),(4,'RUNNING',4,NULL),(5,'PAUSED',5,NULL),(6,'BLOCKED',6,NULL);
/*!40000 ALTER TABLE `test_case_run_status` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `test_case_runs`
--

DROP TABLE IF EXISTS `test_case_runs`;
CREATE TABLE `test_case_runs` (
  `case_run_id` int(11) NOT NULL auto_increment,
  `run_id` int(11) NOT NULL,
  `case_id` int(11) NOT NULL,
  `assignee` mediumint(9) default NULL,
  `testedby` mediumint(9) default NULL,
  `case_run_status_id` tinyint(4) NOT NULL,
  `case_text_version` mediumint(9) NOT NULL,
  `build_id` int(11) NOT NULL,
  `running_date` datetime default NULL,
  `close_date` datetime default NULL,
  `notes` text,
  `iscurrent` tinyint(4) NOT NULL default '0',
  `sortkey` int(11) default NULL,
  `environment_id` int(11) NOT NULL,
  PRIMARY KEY  (`case_run_id`),
  UNIQUE KEY `case_run_build_env_idx` (`run_id`,`case_id`,`build_id`,`environment_id`),
  KEY `case_run_case_id_idx` (`case_id`),
  KEY `case_run_assignee_idx` (`assignee`),
  KEY `case_run_testedby_idx` (`testedby`),
  KEY `case_run_close_date_idx` (`close_date`),
  KEY `case_run_status_idx` (`case_run_status_id`),
  KEY `case_run_text_ver_idx` (`case_text_version`),
  KEY `case_run_build_idx_v2` (`build_id`),
  KEY `case_run_env_idx_v2` (`environment_id`)
) ENGINE=MyISAM AUTO_INCREMENT=12 DEFAULT CHARSET=utf8;

--
-- Dumping data for table `test_case_runs`
--

LOCK TABLES `test_case_runs` WRITE;
/*!40000 ALTER TABLE `test_case_runs` DISABLE KEYS */;
INSERT INTO `test_case_runs` VALUES (1,1,4,0,NULL,1,1,4,NULL,NULL,NULL,1,NULL,3),(2,1,5,5,NULL,1,1,4,NULL,NULL,NULL,1,NULL,3),(3,1,3,5,NULL,1,1,4,NULL,NULL,NULL,1,NULL,3),(4,2,6,8,NULL,1,1,1,NULL,NULL,NULL,1,NULL,1),(5,2,7,8,NULL,1,1,1,NULL,NULL,NULL,1,NULL,1),(6,2,8,8,NULL,1,1,1,NULL,NULL,NULL,1,NULL,1),(7,2,15,8,NULL,1,1,1,NULL,NULL,NULL,1,NULL,1),(8,3,6,8,NULL,1,1,2,NULL,NULL,NULL,1,NULL,2),(9,3,7,8,NULL,1,1,2,NULL,NULL,NULL,1,NULL,2),(10,3,8,8,NULL,1,1,2,NULL,NULL,NULL,1,NULL,2),(11,3,15,8,NULL,1,1,2,NULL,NULL,NULL,1,NULL,2);
/*!40000 ALTER TABLE `test_case_runs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `test_case_status`
--

DROP TABLE IF EXISTS `test_case_status`;
CREATE TABLE `test_case_status` (
  `case_status_id` smallint(6) NOT NULL auto_increment,
  `name` varchar(255) NOT NULL,
  `description` text,
  PRIMARY KEY  (`case_status_id`)
) ENGINE=MyISAM AUTO_INCREMENT=4 DEFAULT CHARSET=utf8;

--
-- Dumping data for table `test_case_status`
--

LOCK TABLES `test_case_status` WRITE;
/*!40000 ALTER TABLE `test_case_status` DISABLE KEYS */;
INSERT INTO `test_case_status` VALUES (1,'PROPOSED',NULL),(2,'CONFIRMED',NULL),(3,'DISABLED',NULL);
/*!40000 ALTER TABLE `test_case_status` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `test_case_tags`
--

DROP TABLE IF EXISTS `test_case_tags`;
CREATE TABLE `test_case_tags` (
  `tag_id` int(11) NOT NULL,
  `case_id` int(11) NOT NULL,
  `userid` mediumint(9) NOT NULL,
  UNIQUE KEY `case_tags_primary_idx` (`tag_id`,`case_id`,`userid`),
  UNIQUE KEY `case_tags_secondary_idx` (`tag_id`,`case_id`),
  KEY `case_tags_case_id_idx_v3` (`case_id`),
  KEY `case_tags_userid_idx` (`userid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Dumping data for table `test_case_tags`
--

LOCK TABLES `test_case_tags` WRITE;
/*!40000 ALTER TABLE `test_case_tags` DISABLE KEYS */;
INSERT INTO `test_case_tags` VALUES (1,5,1),(2,6,1),(2,7,1),(2,8,1),(2,9,1),(2,10,1),(2,11,1),(2,12,1),(2,13,1),(2,14,1),(2,15,1),(3,16,1),(3,17,1),(3,18,1),(3,19,1),(3,20,1),(3,21,1),(3,22,1),(3,23,1),(3,24,1);
/*!40000 ALTER TABLE `test_case_tags` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `test_case_texts`
--

DROP TABLE IF EXISTS `test_case_texts`;
CREATE TABLE `test_case_texts` (
  `case_id` int(11) NOT NULL,
  `case_text_version` mediumint(9) NOT NULL,
  `who` mediumint(9) NOT NULL,
  `creation_ts` datetime NOT NULL,
  `action` mediumtext,
  `effect` mediumtext,
  `setup` mediumtext,
  `breakdown` mediumtext,
  UNIQUE KEY `case_versions_idx` (`case_id`,`case_text_version`),
  KEY `case_versions_who_idx` (`who`),
  KEY `case_versions_creation_ts_idx` (`creation_ts`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Dumping data for table `test_case_texts`
--

LOCK TABLES `test_case_texts` WRITE;
/*!40000 ALTER TABLE `test_case_texts` DISABLE KEYS */;
INSERT INTO `test_case_texts` VALUES (1,1,1,'2008-04-16 13:57:05','<ol>\r\n  <li>PUBLIC TEST CASE 1 - PROPOSED</li><li>PUBLIC CATEGORY 1</li>\r\n</ol>','<ol>\r\n  <li></li>\r\n</ol>','',''),(2,1,1,'2008-04-16 14:01:58','<ol>\r\n  <li>PUBLIC TEST CASE 1 - PROPOSED</li><li>PUBLIC CATEGORY 1</li>\r\n</ol>','<ol>\r\n  <li></li>\r\n</ol>','',''),(3,1,1,'2008-04-16 14:02:11','<ol>\r\n  <li>PUBLIC TEST CASE 1 - PROPOSED</li><li>PUBLIC CATEGORY 1</li>\r\n</ol>','<ol>\r\n  <li></li>\r\n</ol>','',''),(4,1,1,'2008-04-17 09:51:33','<ol>\r\n  <li>PUBLIC TEST CASE - CONFIRMED P2<br></li>\r\n</ol>','<ol>\r\n  <li></li>\r\n</ol>','',''),(5,1,1,'2008-05-01 17:20:41','<div id=\"lipsum\">\r\n<p>\r\nLorem ipsum dolor sit amet, consectetuer adipiscing elit. Nam\r\npellentesque odio et elit. Nam lobortis sem suscipit sapien. Sed\r\niaculis aliquam sapien. Maecenas ut lectus. Aenean fringilla massa et\r\nmetus. Nam varius, sapien nec egestas feugiat, mi libero dignissim\r\norci, id fermentum quam nisl quis risus. Phasellus libero justo,\r\naliquet quis, pellentesque vitae, porttitor quis, orci. Maecenas\r\nsollicitudin. Donec bibendum, ante quis sodales fermentum, quam risus\r\nplacerat pede, nec aliquam lorem odio sit amet nisi. Ut sem tellus,\r\nfeugiat vitae, lobortis nec, dapibus at, est. Aenean cursus. Vivamus\r\nfaucibus lectus eget felis. Nullam commodo tortor vitae turpis.\r\n</p>\r\n<p>Sed mollis interdum risus. Pellentesque ante velit, facilisis vitae,\r\nfermentum eu, feugiat sit amet, dui. Suspendisse tempus ullamcorper\r\nnisl. Suspendisse ullamcorper, velit non luctus gravida, massa turpis\r\nullamcorper eros, sed dictum risus neque ut augue. Vestibulum neque\r\nnulla, pretium fermentum, rutrum vehicula, pulvinar at, est. Quisque\r\ndignissim. Nullam placerat neque vel urna. Quisque cursus lacus rutrum\r\ntortor. Nunc ut elit. Vestibulum mi nunc, volutpat id, tempor ut,\r\nscelerisque vel, magna. Aenean nisl nulla, rutrum sit amet,\r\nsollicitudin sed, molestie eget, nisi. Lorem ipsum dolor sit amet,\r\nconsectetuer adipiscing elit. Class aptent taciti sociosqu ad litora\r\ntorquent per conubia nostra, per inceptos himenaeos. In odio erat,\r\nbibendum eu, gravida nec, elementum sed, urna.\r\n</p>\r\n<p>Aliquam ultricies viverra mi. Ut convallis urna quis urna. Sed sed\r\ntortor. Suspendisse quis tellus. Ut gravida. Ut facilisis lectus in\r\npurus. Sed at est non libero dignissim varius. Donec vestibulum odio ac\r\nfelis. Duis interdum pellentesque nisl. Aenean leo. Curabitur lectus.\r\nCum sociis natoque penatibus et magnis dis parturient montes, nascetur\r\nridiculus mus. Duis nisl ligula, elementum vitae, posuere eu, semper\r\neget, augue. Maecenas metus nulla, ullamcorper id, malesuada sit amet,\r\nmattis nec, lacus. Nam tortor.\r\n</p>\r\n<p>Nam sollicitudin, lacus sit amet aliquam tempus, nulla tellus tempus\r\nvelit, eu sollicitudin dolor dui et velit. In ac sem. Mauris adipiscing\r\nenim in felis. Morbi porttitor laoreet sapien. Nam felis dolor, laoreet\r\nsed, iaculis eu, vulputate eu, nunc. Nullam egestas ligula. Fusce ut\r\nsapien. Aliquam erat volutpat. Proin tristique scelerisque sem. Nullam\r\nnon erat.\r\n</p>\r\n<p>Sed feugiat, lacus in elementum egestas, sapien nulla sodales leo,\r\nnec scelerisque diam eros eu arcu. Phasellus ut magna. Cras dignissim\r\npellentesque tellus. Curabitur sapien. Suspendisse a risus lobortis\r\nquam consectetuer placerat. Aliquam ultricies pretium tortor. Aliquam\r\nerat volutpat. Mauris nunc. Etiam vitae diam. Aenean a felis. Donec\r\nposuere, lacus in lacinia commodo, ligula lectus rutrum nibh, non\r\ndapibus sapien enim eu mauris. Pellentesque arcu risus, condimentum id,\r\ndapibus in, blandit ut, pede. Nulla facilisi. Vestibulum elit quam,\r\nfringilla convallis, congue lacinia, dictum at, velit. Vestibulum ante\r\nipsum primis in faucibus orci luctus et ultrices posuere cubilia Curae;\r\nSed augue mauris, commodo vel, tincidunt hendrerit, consectetuer eu,\r\neros.\r\n</p></div><ol>\r\n  <li><br></li>\r\n</ol>','<div id=\"lipsum\">\r\n<p>\r\nLorem ipsum dolor sit amet, consectetuer adipiscing elit. Nam\r\npellentesque odio et elit. Nam lobortis sem suscipit sapien. Sed\r\niaculis aliquam sapien. Maecenas ut lectus. Aenean fringilla massa et\r\nmetus. Nam varius, sapien nec egestas feugiat, mi libero dignissim\r\norci, id fermentum quam nisl quis risus. Phasellus libero justo,\r\naliquet quis, pellentesque vitae, porttitor quis, orci. Maecenas\r\nsollicitudin. Donec bibendum, ante quis sodales fermentum, quam risus\r\nplacerat pede, nec aliquam lorem odio sit amet nisi. Ut sem tellus,\r\nfeugiat vitae, lobortis nec, dapibus at, est. Aenean cursus. Vivamus\r\nfaucibus lectus eget felis. Nullam commodo tortor vitae turpis.\r\n</p>\r\n<p>Sed mollis interdum risus. Pellentesque ante velit, facilisis vitae,\r\nfermentum eu, feugiat sit amet, dui. Suspendisse tempus ullamcorper\r\nnisl. Suspendisse ullamcorper, velit non luctus gravida, massa turpis\r\nullamcorper eros, sed dictum risus neque ut augue. Vestibulum neque\r\nnulla, pretium fermentum, rutrum vehicula, pulvinar at, est. Quisque\r\ndignissim. Nullam placerat neque vel urna. Quisque cursus lacus rutrum\r\ntortor. Nunc ut elit. Vestibulum mi nunc, volutpat id, tempor ut,\r\nscelerisque vel, magna. Aenean nisl nulla, rutrum sit amet,\r\nsollicitudin sed, molestie eget, nisi. Lorem ipsum dolor sit amet,\r\nconsectetuer adipiscing elit. Class aptent taciti sociosqu ad litora\r\ntorquent per conubia nostra, per inceptos himenaeos. In odio erat,\r\nbibendum eu, gravida nec, elementum sed, urna.\r\n</p>\r\n<p>Aliquam ultricies viverra mi. Ut convallis urna quis urna. Sed sed\r\ntortor. Suspendisse quis tellus. Ut gravida. Ut facilisis lectus in\r\npurus. Sed at est non libero dignissim varius. Donec vestibulum odio ac\r\nfelis. Duis interdum pellentesque nisl. Aenean leo. Curabitur lectus.\r\nCum sociis natoque penatibus et magnis dis parturient montes, nascetur\r\nridiculus mus. Duis nisl ligula, elementum vitae, posuere eu, semper\r\neget, augue. Maecenas metus nulla, ullamcorper id, malesuada sit amet,\r\nmattis nec, lacus. Nam tortor.\r\n</p>\r\n<p>Nam sollicitudin, lacus sit amet aliquam tempus, nulla tellus tempus\r\nvelit, eu sollicitudin dolor dui et velit. In ac sem. Mauris adipiscing\r\nenim in felis. Morbi porttitor laoreet sapien. Nam felis dolor, laoreet\r\nsed, iaculis eu, vulputate eu, nunc. Nullam egestas ligula. Fusce ut\r\nsapien. Aliquam erat volutpat. Proin tristique scelerisque sem. Nullam\r\nnon erat.\r\n</p>\r\n<p>Sed feugiat, lacus in elementum egestas, sapien nulla sodales leo,\r\nnec scelerisque diam eros eu arcu. Phasellus ut magna. Cras dignissim\r\npellentesque tellus. Curabitur sapien. Suspendisse a risus lobortis\r\nquam consectetuer placerat. Aliquam ultricies pretium tortor. Aliquam\r\nerat volutpat. Mauris nunc. Etiam vitae diam. Aenean a felis. Donec\r\nposuere, lacus in lacinia commodo, ligula lectus rutrum nibh, non\r\ndapibus sapien enim eu mauris. Pellentesque arcu risus, condimentum id,\r\ndapibus in, blandit ut, pede. Nulla facilisi. Vestibulum elit quam,\r\nfringilla convallis, congue lacinia, dictum at, velit. Vestibulum ante\r\nipsum primis in faucibus orci luctus et ultrices posuere cubilia Curae;\r\nSed augue mauris, commodo vel, tincidunt hendrerit, consectetuer eu,\r\neros.\r\n</p></div><ol>\r\n  <li><br></li>\r\n</ol>','&nbsp;<div id=\"lipsum\">\r\n<p>\r\nLorem ipsum dolor sit amet, consectetuer adipiscing elit. Nam\r\npellentesque odio et elit. Nam lobortis sem suscipit sapien. Sed\r\niaculis aliquam sapien. Maecenas ut lectus. Aenean fringilla massa et\r\nmetus. Nam varius, sapien nec egestas feugiat, mi libero dignissim\r\norci, id fermentum quam nisl quis risus. Phasellus libero justo,\r\naliquet quis, pellentesque vitae, porttitor quis, orci. Maecenas\r\nsollicitudin. Donec bibendum, ante quis sodales fermentum, quam risus\r\nplacerat pede, nec aliquam lorem odio sit amet nisi. Ut sem tellus,\r\nfeugiat vitae, lobortis nec, dapibus at, est. Aenean cursus. Vivamus\r\nfaucibus lectus eget felis. Nullam commodo tortor vitae turpis.\r\n</p>\r\n<p>Sed mollis interdum risus. Pellentesque ante velit, facilisis vitae,\r\nfermentum eu, feugiat sit amet, dui. Suspendisse tempus ullamcorper\r\nnisl. Suspendisse ullamcorper, velit non luctus gravida, massa turpis\r\nullamcorper eros, sed dictum risus neque ut augue. Vestibulum neque\r\nnulla, pretium fermentum, rutrum vehicula, pulvinar at, est. Quisque\r\ndignissim. Nullam placerat neque vel urna. Quisque cursus lacus rutrum\r\ntortor. Nunc ut elit. Vestibulum mi nunc, volutpat id, tempor ut,\r\nscelerisque vel, magna. Aenean nisl nulla, rutrum sit amet,\r\nsollicitudin sed, molestie eget, nisi. Lorem ipsum dolor sit amet,\r\nconsectetuer adipiscing elit. Class aptent taciti sociosqu ad litora\r\ntorquent per conubia nostra, per inceptos himenaeos. In odio erat,\r\nbibendum eu, gravida nec, elementum sed, urna.\r\n</p>\r\n<p>Aliquam ultricies viverra mi. Ut convallis urna quis urna. Sed sed\r\ntortor. Suspendisse quis tellus. Ut gravida. Ut facilisis lectus in\r\npurus. Sed at est non libero dignissim varius. Donec vestibulum odio ac\r\nfelis. Duis interdum pellentesque nisl. Aenean leo. Curabitur lectus.\r\nCum sociis natoque penatibus et magnis dis parturient montes, nascetur\r\nridiculus mus. Duis nisl ligula, elementum vitae, posuere eu, semper\r\neget, augue. Maecenas metus nulla, ullamcorper id, malesuada sit amet,\r\nmattis nec, lacus. Nam tortor.\r\n</p>\r\n<p>Nam sollicitudin, lacus sit amet aliquam tempus, nulla tellus tempus\r\nvelit, eu sollicitudin dolor dui et velit. In ac sem. Mauris adipiscing\r\nenim in felis. Morbi porttitor laoreet sapien. Nam felis dolor, laoreet\r\nsed, iaculis eu, vulputate eu, nunc. Nullam egestas ligula. Fusce ut\r\nsapien. Aliquam erat volutpat. Proin tristique scelerisque sem. Nullam\r\nnon erat.\r\n</p>\r\n<p>Sed feugiat, lacus in elementum egestas, sapien nulla sodales leo,\r\nnec scelerisque diam eros eu arcu. Phasellus ut magna. Cras dignissim\r\npellentesque tellus. Curabitur sapien. Suspendisse a risus lobortis\r\nquam consectetuer placerat. Aliquam ultricies pretium tortor. Aliquam\r\nerat volutpat. Mauris nunc. Etiam vitae diam. Aenean a felis. Donec\r\nposuere, lacus in lacinia commodo, ligula lectus rutrum nibh, non\r\ndapibus sapien enim eu mauris. Pellentesque arcu risus, condimentum id,\r\ndapibus in, blandit ut, pede. Nulla facilisi. Vestibulum elit quam,\r\nfringilla convallis, congue lacinia, dictum at, velit. Vestibulum ante\r\nipsum primis in faucibus orci luctus et ultrices posuere cubilia Curae;\r\nSed augue mauris, commodo vel, tincidunt hendrerit, consectetuer eu,\r\neros.\r\n</p></div>','&nbsp;<div id=\"lipsum\">\r\n<p>\r\nLorem ipsum dolor sit amet, consectetuer adipiscing elit. Nam\r\npellentesque odio et elit. Nam lobortis sem suscipit sapien. Sed\r\niaculis aliquam sapien. Maecenas ut lectus. Aenean fringilla massa et\r\nmetus. Nam varius, sapien nec egestas feugiat, mi libero dignissim\r\norci, id fermentum quam nisl quis risus. Phasellus libero justo,\r\naliquet quis, pellentesque vitae, porttitor quis, orci. Maecenas\r\nsollicitudin. Donec bibendum, ante quis sodales fermentum, quam risus\r\nplacerat pede, nec aliquam lorem odio sit amet nisi. Ut sem tellus,\r\nfeugiat vitae, lobortis nec, dapibus at, est. Aenean cursus. Vivamus\r\nfaucibus lectus eget felis. Nullam commodo tortor vitae turpis.\r\n</p>\r\n<p>Sed mollis interdum risus. Pellentesque ante velit, facilisis vitae,\r\nfermentum eu, feugiat sit amet, dui. Suspendisse tempus ullamcorper\r\nnisl. Suspendisse ullamcorper, velit non luctus gravida, massa turpis\r\nullamcorper eros, sed dictum risus neque ut augue. Vestibulum neque\r\nnulla, pretium fermentum, rutrum vehicula, pulvinar at, est. Quisque\r\ndignissim. Nullam placerat neque vel urna. Quisque cursus lacus rutrum\r\ntortor. Nunc ut elit. Vestibulum mi nunc, volutpat id, tempor ut,\r\nscelerisque vel, magna. Aenean nisl nulla, rutrum sit amet,\r\nsollicitudin sed, molestie eget, nisi. Lorem ipsum dolor sit amet,\r\nconsectetuer adipiscing elit. Class aptent taciti sociosqu ad litora\r\ntorquent per conubia nostra, per inceptos himenaeos. In odio erat,\r\nbibendum eu, gravida nec, elementum sed, urna.\r\n</p>\r\n<p>Aliquam ultricies viverra mi. Ut convallis urna quis urna. Sed sed\r\ntortor. Suspendisse quis tellus. Ut gravida. Ut facilisis lectus in\r\npurus. Sed at est non libero dignissim varius. Donec vestibulum odio ac\r\nfelis. Duis interdum pellentesque nisl. Aenean leo. Curabitur lectus.\r\nCum sociis natoque penatibus et magnis dis parturient montes, nascetur\r\nridiculus mus. Duis nisl ligula, elementum vitae, posuere eu, semper\r\neget, augue. Maecenas metus nulla, ullamcorper id, malesuada sit amet,\r\nmattis nec, lacus. Nam tortor.\r\n</p>\r\n<p>Nam sollicitudin, lacus sit amet aliquam tempus, nulla tellus tempus\r\nvelit, eu sollicitudin dolor dui et velit. In ac sem. Mauris adipiscing\r\nenim in felis. Morbi porttitor laoreet sapien. Nam felis dolor, laoreet\r\nsed, iaculis eu, vulputate eu, nunc. Nullam egestas ligula. Fusce ut\r\nsapien. Aliquam erat volutpat. Proin tristique scelerisque sem. Nullam\r\nnon erat.\r\n</p>\r\n<p>Sed feugiat, lacus in elementum egestas, sapien nulla sodales leo,\r\nnec scelerisque diam eros eu arcu. Phasellus ut magna. Cras dignissim\r\npellentesque tellus. Curabitur sapien. Suspendisse a risus lobortis\r\nquam consectetuer placerat. Aliquam ultricies pretium tortor. Aliquam\r\nerat volutpat. Mauris nunc. Etiam vitae diam. Aenean a felis. Donec\r\nposuere, lacus in lacinia commodo, ligula lectus rutrum nibh, non\r\ndapibus sapien enim eu mauris. Pellentesque arcu risus, condimentum id,\r\ndapibus in, blandit ut, pede. Nulla facilisi. Vestibulum elit quam,\r\nfringilla convallis, congue lacinia, dictum at, velit. Vestibulum ante\r\nipsum primis in faucibus orci luctus et ultrices posuere cubilia Curae;\r\nSed augue mauris, commodo vel, tincidunt hendrerit, consectetuer eu,\r\neros.\r\n</p></div>'),(6,1,1,'2008-05-02 14:20:00','<ol>\r\n  <li>STEP ONE</li><li>STEP TWO</li><li>STEP THREE<br></li>\r\n</ol>','<ol>\r\n  <li>REACTION ONE</li><li>REACTION TWO</li><li>REACTION THREE<br></li>\r\n</ol>','&nbsp;SETUP<br>','&nbsp;BREAKDOWN'),(7,1,1,'2008-05-02 14:20:08','<ol>\r\n  <li>STEP ONE</li><li>STEP TWO</li><li>STEP THREE<br></li>\r\n</ol>','<ol>\r\n  <li>REACTION ONE</li><li>REACTION TWO</li><li>REACTION THREE<br></li>\r\n</ol>','&nbsp;SETUP<br>','&nbsp;BREAKDOWN'),(8,1,1,'2008-05-02 14:20:12','<ol>\r\n  <li>STEP ONE</li><li>STEP TWO</li><li>STEP THREE<br></li>\r\n</ol>','<ol>\r\n  <li>REACTION ONE</li><li>REACTION TWO</li><li>REACTION THREE<br></li>\r\n</ol>','&nbsp;SETUP<br>','&nbsp;BREAKDOWN'),(9,1,1,'2008-05-02 14:20:20','<ol>\r\n  <li>STEP ONE</li><li>STEP TWO</li><li>STEP THREE<br></li>\r\n</ol>','<ol>\r\n  <li>REACTION ONE</li><li>REACTION TWO</li><li>REACTION THREE<br></li>\r\n</ol>','&nbsp;SETUP<br>','&nbsp;BREAKDOWN'),(10,1,1,'2008-05-02 14:20:23','<ol>\r\n  <li>STEP ONE</li><li>STEP TWO</li><li>STEP THREE<br></li>\r\n</ol>','<ol>\r\n  <li>REACTION ONE</li><li>REACTION TWO</li><li>REACTION THREE<br></li>\r\n</ol>','&nbsp;SETUP<br>','&nbsp;BREAKDOWN'),(11,1,1,'2008-05-02 14:20:26','<ol>\r\n  <li>STEP ONE</li><li>STEP TWO</li><li>STEP THREE<br></li>\r\n</ol>','<ol>\r\n  <li>REACTION ONE</li><li>REACTION TWO</li><li>REACTION THREE<br></li>\r\n</ol>','&nbsp;SETUP<br>','&nbsp;BREAKDOWN'),(12,1,1,'2008-05-02 14:20:36','<ol>\r\n  <li>STEP ONE</li><li>STEP TWO</li><li>STEP THREE<br></li>\r\n</ol>','<ol>\r\n  <li>REACTION ONE</li><li>REACTION TWO</li><li>REACTION THREE<br></li>\r\n</ol>','&nbsp;SETUP<br>','&nbsp;BREAKDOWN'),(13,1,1,'2008-05-02 14:21:02','<ol>\r\n  <li>STEP ONE</li><li>STEP TWO</li><li>STEP THREE<br></li>\r\n</ol>','<ol>\r\n  <li>REACTION ONE</li><li>REACTION TWO</li><li>REACTION THREE<br></li>\r\n</ol>','&nbsp;SETUP<br>','&nbsp;BREAKDOWN'),(14,1,1,'2008-05-02 14:21:06','<ol>\r\n  <li>STEP ONE</li><li>STEP TWO</li><li>STEP THREE<br></li>\r\n</ol>','<ol>\r\n  <li>REACTION ONE</li><li>REACTION TWO</li><li>REACTION THREE<br></li>\r\n</ol>','&nbsp;SETUP<br>','&nbsp;BREAKDOWN'),(15,1,1,'2008-05-02 14:21:14','<ol>\r\n  <li>STEP ONE</li><li>STEP TWO</li><li>STEP THREE<br></li>\r\n</ol>','<ol>\r\n  <li>REACTION ONE</li><li>REACTION TWO</li><li>REACTION THREE<br></li>\r\n</ol>','&nbsp;SETUP<br>','&nbsp;BREAKDOWN'),(16,1,1,'2008-05-02 14:25:41','<ol>\r\n  <li>STEP ONE FOR PARTNER</li><li>STEP TWO</li><li>STEP THREE<br></li>\r\n</ol>','<ol>\r\n  <li>RESULTS FOR PARTNER<br></li>\r\n</ol>','&nbsp;SETTING UP FOR PARTNER <br>','&nbsp;BREAKING DOWN FOR PARTNER<br>'),(17,1,1,'2008-05-02 14:25:56','<ol>\r\n  <li>STEP ONE FOR PARTNER</li><li>STEP TWO</li><li>STEP THREE<br></li>\r\n</ol>','<ol>\r\n  <li>RESULTS FOR PARTNER<br></li>\r\n</ol>','&nbsp;SETTING UP FOR PARTNER <br>','&nbsp;BREAKING DOWN FOR PARTNER<br>'),(18,1,1,'2008-05-02 14:25:59','<ol>\r\n  <li>STEP ONE FOR PARTNER</li><li>STEP TWO</li><li>STEP THREE<br></li>\r\n</ol>','<ol>\r\n  <li>RESULTS FOR PARTNER<br></li>\r\n</ol>','&nbsp;SETTING UP FOR PARTNER <br>','&nbsp;BREAKING DOWN FOR PARTNER<br>'),(19,1,1,'2008-05-02 14:26:11','<ol>\r\n  <li>STEP ONE FOR PARTNER</li><li>STEP TWO</li><li>STEP THREE<br></li>\r\n</ol>','<ol>\r\n  <li>RESULTS FOR PARTNER<br></li>\r\n</ol>','&nbsp;SETTING UP FOR PARTNER <br>','&nbsp;BREAKING DOWN FOR PARTNER<br>'),(20,1,1,'2008-05-02 14:26:22','<ol>\r\n  <li>STEP ONE FOR PARTNER</li><li>STEP TWO</li><li>STEP THREE<br></li>\r\n</ol>','<ol>\r\n  <li>RESULTS FOR PARTNER<br></li>\r\n</ol>','&nbsp;SETTING UP FOR PARTNER <br>','&nbsp;BREAKING DOWN FOR PARTNER<br>'),(21,1,1,'2008-05-02 14:26:33','<ol>\r\n  <li>STEP ONE FOR PARTNER</li><li>STEP TWO</li><li>STEP THREE<br></li>\r\n</ol>','<ol>\r\n  <li>RESULTS FOR PARTNER<br></li>\r\n</ol>','&nbsp;SETTING UP FOR PARTNER <br>','&nbsp;BREAKING DOWN FOR PARTNER<br>'),(22,1,1,'2008-05-02 14:26:41','<ol>\r\n  <li>STEP ONE FOR PARTNER</li><li>STEP TWO</li><li>STEP THREE<br></li>\r\n</ol>','<ol>\r\n  <li>RESULTS FOR PARTNER<br></li>\r\n</ol>','&nbsp;SETTING UP FOR PARTNER <br>','&nbsp;BREAKING DOWN FOR PARTNER<br>'),(23,1,1,'2008-05-02 14:26:48','<ol>\r\n  <li>STEP ONE FOR PARTNER</li><li>STEP TWO</li><li>STEP THREE<br></li>\r\n</ol>','<ol>\r\n  <li>RESULTS FOR PARTNER<br></li>\r\n</ol>','&nbsp;SETTING UP FOR PARTNER <br>','&nbsp;BREAKING DOWN FOR PARTNER<br>'),(24,1,1,'2008-05-02 14:26:55','<ol>\r\n  <li>STEP ONE FOR PARTNER</li><li>STEP TWO</li><li>STEP THREE<br></li>\r\n</ol>','<ol>\r\n  <li>RESULTS FOR PARTNER<br></li>\r\n</ol>','&nbsp;SETTING UP FOR PARTNER <br>','&nbsp;BREAKING DOWN FOR PARTNER<br>');
/*!40000 ALTER TABLE `test_case_texts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `test_cases`
--

DROP TABLE IF EXISTS `test_cases`;
CREATE TABLE `test_cases` (
  `case_id` int(11) NOT NULL auto_increment,
  `case_status_id` tinyint(4) NOT NULL,
  `category_id` smallint(6) NOT NULL,
  `priority_id` smallint(6) default NULL,
  `author_id` mediumint(9) NOT NULL,
  `default_tester_id` mediumint(9) default NULL,
  `creation_date` datetime NOT NULL,
  `estimated_time` time default NULL,
  `isautomated` tinyint(4) NOT NULL default '0',
  `sortkey` int(11) default NULL,
  `script` mediumtext,
  `arguments` mediumtext,
  `summary` varchar(255) default NULL,
  `requirement` varchar(255) default NULL,
  `alias` varchar(255) default NULL,
  PRIMARY KEY  (`case_id`),
  KEY `test_case_category_idx` (`category_id`),
  KEY `test_case_author_idx` (`author_id`),
  KEY `test_case_creation_date_idx` (`creation_date`),
  KEY `test_case_sortkey_idx` (`sortkey`),
  KEY `test_case_shortname_idx` (`alias`),
  KEY `test_case_requirement_idx` (`requirement`),
  KEY `test_case_status_idx` (`case_status_id`),
  KEY `test_case_tester_idx` (`default_tester_id`)
) ENGINE=MyISAM AUTO_INCREMENT=25 DEFAULT CHARSET=utf8;

--
-- Dumping data for table `test_cases`
--

LOCK TABLES `test_cases` WRITE;
/*!40000 ALTER TABLE `test_cases` DISABLE KEYS */;
INSERT INTO `test_cases` VALUES (1,1,1,1,1,5,'2008-04-16 13:57:05','00:00:00',0,NULL,'','','PUBLIC TEST CASE 1 - PROPOSED','',NULL),(2,3,1,2,1,5,'2008-04-16 14:01:58','00:00:00',0,NULL,'','','PUBLIC TEST CASE 1 - DISABLED','',NULL),(3,2,1,1,1,5,'2008-04-16 14:02:11','00:00:00',0,NULL,'','','PUBLIC TEST CASE 1 - CONFIRMED','',NULL),(4,2,1,2,1,NULL,'2008-04-17 09:51:33','00:00:00',1,NULL,'PUBLIC SCRIPT','PUBLIC ARG','PUBLIC TEST CASE 2 - CONFIRMED','PUBLIC REQUIREMENT 1',NULL),(5,2,6,3,1,5,'2008-05-01 17:20:41','00:00:00',1,NULL,'script','arg1','PUBLIC TEST CASE 3 - CONFIRMED','',NULL),(6,2,2,3,1,8,'2008-05-02 14:20:00','12:00:00',0,NULL,'','','PRIVATE CASE','PUBLIC REQUIREMENT 1',NULL),(7,2,2,3,1,8,'2008-05-02 14:20:08','12:00:00',0,NULL,'','','PRIVATE CASE','PUBLIC REQUIREMENT 1',NULL),(8,2,2,3,1,8,'2008-05-02 14:20:12','12:00:00',0,NULL,'','','PRIVATE CASE','PUBLIC REQUIREMENT 1',NULL),(9,1,2,3,1,8,'2008-05-02 14:20:20','12:00:00',0,NULL,'','','PRIVATE CASE','PUBLIC REQUIREMENT 1',NULL),(10,1,2,3,1,8,'2008-05-02 14:20:23','12:00:00',0,NULL,'','','PRIVATE CASE','PUBLIC REQUIREMENT 1',NULL),(11,1,2,3,1,8,'2008-05-02 14:20:26','12:00:00',0,NULL,'','','PRIVATE CASE','PUBLIC REQUIREMENT 1',NULL),(12,3,2,3,1,8,'2008-05-02 14:20:36','12:00:00',0,NULL,'','','PRIVATE CASE','PUBLIC REQUIREMENT 1',NULL),(13,3,2,1,1,8,'2008-05-02 14:21:02','12:00:00',1,NULL,'auto script','-a -b -c','PRIVATE CASE','PUBLIC REQUIREMENT 1',NULL),(14,3,2,1,1,8,'2008-05-02 14:21:06','12:00:00',1,NULL,'auto script','-a -b -c','PRIVATE CASE','PUBLIC REQUIREMENT 1',NULL),(15,2,2,1,1,8,'2008-05-02 14:21:14','12:00:00',1,NULL,'auto script','-a -b -c','PRIVATE CASE','PUBLIC REQUIREMENT 1',NULL),(16,2,4,3,1,6,'2008-05-02 14:25:41','00:00:30',0,NULL,'','','PARTNER CASE','PARTNER REQUIREMENT',NULL),(17,2,4,3,1,6,'2008-05-02 14:25:56','00:00:30',0,NULL,'','','PARTNER CASE','PARTNER REQUIREMENT',NULL),(18,2,4,3,1,6,'2008-05-02 14:25:59','00:00:30',0,NULL,'','','PARTNER CASE','PARTNER REQUIREMENT',NULL),(19,1,4,2,1,6,'2008-05-02 14:26:11','00:00:30',0,NULL,'','','PARTNER CASE','PARTNER REQUIREMENT',NULL),(20,3,4,4,1,6,'2008-05-02 14:26:22','00:00:30',0,NULL,'','','PARTNER CASE','PARTNER REQUIREMENT',NULL),(21,2,4,5,1,6,'2008-05-02 14:26:33','00:00:30',0,NULL,'','','PARTNER CASE','PARTNER REQUIREMENT',NULL),(22,2,3,5,1,6,'2008-05-02 14:26:41','00:00:30',0,NULL,'','','PARTNER CASE','PARTNER REQUIREMENT',NULL),(23,2,3,3,1,6,'2008-05-02 14:26:48','00:00:30',0,NULL,'','','PARTNER CASE','PARTNER REQUIREMENT',NULL),(24,2,3,1,1,6,'2008-05-02 14:26:55','00:00:30',0,NULL,'','','PARTNER CASE','PARTNER REQUIREMENT',NULL);
/*!40000 ALTER TABLE `test_cases` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `test_email_settings`
--

DROP TABLE IF EXISTS `test_email_settings`;
CREATE TABLE `test_email_settings` (
  `userid` mediumint(9) NOT NULL,
  `eventid` tinyint(4) NOT NULL,
  `relationship_id` tinyint(4) NOT NULL,
  UNIQUE KEY `test_email_setting_user_id_idx` (`userid`,`relationship_id`,`eventid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Dumping data for table `test_email_settings`
--

LOCK TABLES `test_email_settings` WRITE;
/*!40000 ALTER TABLE `test_email_settings` DISABLE KEYS */;
/*!40000 ALTER TABLE `test_email_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `test_environment_category`
--

DROP TABLE IF EXISTS `test_environment_category`;
CREATE TABLE `test_environment_category` (
  `env_category_id` int(11) NOT NULL auto_increment,
  `product_id` smallint(6) NOT NULL,
  `name` varchar(255) default NULL,
  PRIMARY KEY  (`env_category_id`),
  UNIQUE KEY `test_environment_category_key1` (`env_category_id`,`product_id`),
  UNIQUE KEY `test_environment_category_key2` (`product_id`,`name`)
) ENGINE=MyISAM AUTO_INCREMENT=4 DEFAULT CHARSET=utf8;

--
-- Dumping data for table `test_environment_category`
--

LOCK TABLES `test_environment_category` WRITE;
/*!40000 ALTER TABLE `test_environment_category` DISABLE KEYS */;
INSERT INTO `test_environment_category` VALUES (1,0,'Operating System'),(2,0,'Hardware'),(3,3,'New category 1');
/*!40000 ALTER TABLE `test_environment_category` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `test_environment_element`
--

DROP TABLE IF EXISTS `test_environment_element`;
CREATE TABLE `test_environment_element` (
  `element_id` int(11) NOT NULL auto_increment,
  `env_category_id` int(11) NOT NULL,
  `name` varchar(255) default NULL,
  `parent_id` int(11) default NULL,
  `isprivate` tinyint(4) NOT NULL default '0',
  PRIMARY KEY  (`element_id`),
  UNIQUE KEY `test_environment_element_key1` (`element_id`,`env_category_id`),
  UNIQUE KEY `test_environment_element_key2` (`env_category_id`,`name`)
) ENGINE=MyISAM AUTO_INCREMENT=11 DEFAULT CHARSET=utf8;

--
-- Dumping data for table `test_environment_element`
--

LOCK TABLES `test_environment_element` WRITE;
/*!40000 ALTER TABLE `test_environment_element` DISABLE KEYS */;
INSERT INTO `test_environment_element` VALUES (1,1,'All',0,0),(2,1,'Linux',0,0),(3,1,'Mac OS',0,0),(4,1,'Other',0,0),(5,1,'Windows',0,0),(6,2,'All',0,0),(7,2,'Macintosh',0,0),(8,2,'Other',0,0),(9,2,'PC',0,0),(10,3,'New element 1',0,0);
/*!40000 ALTER TABLE `test_environment_element` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `test_environment_map`
--

DROP TABLE IF EXISTS `test_environment_map`;
CREATE TABLE `test_environment_map` (
  `environment_id` int(11) NOT NULL,
  `property_id` int(11) NOT NULL,
  `element_id` int(11) NOT NULL,
  `value_selected` tinytext,
  UNIQUE KEY `test_environment_map_key3` (`environment_id`,`element_id`,`property_id`),
  KEY `env_map_env_element_idx` (`environment_id`,`element_id`),
  KEY `env_map_property_idx` (`environment_id`,`property_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Dumping data for table `test_environment_map`
--

LOCK TABLES `test_environment_map` WRITE;
/*!40000 ALTER TABLE `test_environment_map` DISABLE KEYS */;
/*!40000 ALTER TABLE `test_environment_map` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `test_environment_property`
--

DROP TABLE IF EXISTS `test_environment_property`;
CREATE TABLE `test_environment_property` (
  `property_id` int(11) NOT NULL auto_increment,
  `element_id` int(11) NOT NULL,
  `name` varchar(255) default NULL,
  `validexp` text,
  PRIMARY KEY  (`property_id`),
  UNIQUE KEY `test_environment_property_key1` (`property_id`,`element_id`),
  UNIQUE KEY `test_environment_property_key2` (`element_id`,`name`)
) ENGINE=MyISAM AUTO_INCREMENT=2 DEFAULT CHARSET=utf8;

--
-- Dumping data for table `test_environment_property`
--

LOCK TABLES `test_environment_property` WRITE;
/*!40000 ALTER TABLE `test_environment_property` DISABLE KEYS */;
INSERT INTO `test_environment_property` VALUES (1,10,'New property 1','');
/*!40000 ALTER TABLE `test_environment_property` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `test_environments`
--

DROP TABLE IF EXISTS `test_environments`;
CREATE TABLE `test_environments` (
  `environment_id` int(11) NOT NULL auto_increment,
  `product_id` smallint(6) NOT NULL,
  `name` varchar(255) default NULL,
  `isactive` tinyint(4) NOT NULL default '1',
  PRIMARY KEY  (`environment_id`),
  UNIQUE KEY `test_environments_key1` (`environment_id`,`product_id`),
  UNIQUE KEY `test_environments_key2` (`product_id`,`name`),
  KEY `environment_name_idx_v2` (`name`)
) ENGINE=MyISAM AUTO_INCREMENT=7 DEFAULT CHARSET=utf8;

--
-- Dumping data for table `test_environments`
--

LOCK TABLES `test_environments` WRITE;
/*!40000 ALTER TABLE `test_environments` DISABLE KEYS */;
INSERT INTO `test_environments` VALUES (1,2,'PRIVATE ACTIVE ENVIRONMENT',1),(2,2,'PRIVATE INACTIVE ENVIRONMENT',0),(3,1,'PUBLIC ACTIVE ENVIRONMENT',1),(4,3,'PARTNER ACTIVE ENVIRONMENT',1),(5,3,'PARTNER INACTIVE ENVIRONMENT',0),(6,1,'PUBLIC INACTIVE ENVIRONMENT',0);
/*!40000 ALTER TABLE `test_environments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `test_events`
--

DROP TABLE IF EXISTS `test_events`;
CREATE TABLE `test_events` (
  `eventid` tinyint(4) NOT NULL,
  `name` varchar(50) default NULL,
  PRIMARY KEY  (`eventid`),
  KEY `test_event_name_idx` (`name`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Dumping data for table `test_events`
--

LOCK TABLES `test_events` WRITE;
/*!40000 ALTER TABLE `test_events` DISABLE KEYS */;
/*!40000 ALTER TABLE `test_events` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `test_fielddefs`
--

DROP TABLE IF EXISTS `test_fielddefs`;
CREATE TABLE `test_fielddefs` (
  `fieldid` smallint(6) NOT NULL auto_increment,
  `name` varchar(100) NOT NULL,
  `description` mediumtext,
  `table_name` varchar(100) NOT NULL,
  PRIMARY KEY  (`fieldid`)
) ENGINE=MyISAM AUTO_INCREMENT=25 DEFAULT CHARSET=utf8;

--
-- Dumping data for table `test_fielddefs`
--

LOCK TABLES `test_fielddefs` WRITE;
/*!40000 ALTER TABLE `test_fielddefs` DISABLE KEYS */;
INSERT INTO `test_fielddefs` VALUES (1,'isactive','Archived','test_plans'),(2,'name','Plan Name','test_plans'),(3,'type_id','Plan Type','test_plans'),(4,'case_status_id','Case Status','test_cases'),(5,'category_id','Category','test_cases'),(6,'priority_id','Priority','test_cases'),(7,'summary','Run Summary','test_cases'),(8,'isautomated','Automated','test_cases'),(9,'alias','Alias','test_cases'),(10,'requirement','Requirement','test_cases'),(11,'script','Script','test_cases'),(12,'arguments','Argument','test_cases'),(13,'product_id','Product','test_plans'),(14,'default_product_version','Default Product Version','test_plans'),(15,'environment_id','Environment','test_runs'),(16,'product_version','Product Version','test_runs'),(17,'build_id','Default Build','test_runs'),(18,'plan_text_version','Plan Text Version','test_runs'),(19,'manager_id','Manager','test_runs'),(20,'default_tester_id','Default Tester','test_cases'),(21,'stop_date','Stop Date','test_runs'),(22,'summary','Run Summary','test_runs'),(23,'notes','Notes','test_runs'),(24,'estimated_time','Estimated Time','test_cases');
/*!40000 ALTER TABLE `test_fielddefs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `test_named_queries`
--

DROP TABLE IF EXISTS `test_named_queries`;
CREATE TABLE `test_named_queries` (
  `userid` mediumint(9) NOT NULL,
  `name` varchar(64) NOT NULL,
  `isvisible` tinyint(4) NOT NULL default '1',
  `query` mediumtext NOT NULL,
  `type` mediumint(9) NOT NULL default '0',
  UNIQUE KEY `test_namedquery_primary_idx` (`userid`,`name`),
  KEY `test_namedquery_name_idx` (`name`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Dumping data for table `test_named_queries`
--

LOCK TABLES `test_named_queries` WRITE;
/*!40000 ALTER TABLE `test_named_queries` DISABLE KEYS */;
INSERT INTO `test_named_queries` VALUES (1,'__plan__',0,'2',0),(1,'__environment__',0,'1,2',0),(1,'__case__',0,'6,7,8,15',0),(1,'__run__',0,'1',0),(3,'__plan__',0,'1,2,3',0),(1,'__case_run__',0,'8,9,10,11',0),(3,'__case__',0,'6,7,8,9,10,11,12,13,14,15',0),(3,'__run__',0,'1',0),(3,'__case_run__',0,'8,9,10,11',0),(3,'__environment__',0,'1,2',0);
/*!40000 ALTER TABLE `test_named_queries` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `test_plan_activity`
--

DROP TABLE IF EXISTS `test_plan_activity`;
CREATE TABLE `test_plan_activity` (
  `plan_id` int(11) NOT NULL,
  `fieldid` smallint(6) NOT NULL,
  `who` mediumint(9) NOT NULL,
  `changed` datetime NOT NULL,
  `oldvalue` mediumtext,
  `newvalue` mediumtext,
  KEY `plan_activity_primary_idx` (`plan_id`),
  KEY `plan_activity_field_idx` (`fieldid`),
  KEY `plan_activity_who_idx` (`who`),
  KEY `plan_activity_changed_idx` (`changed`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Dumping data for table `test_plan_activity`
--

LOCK TABLES `test_plan_activity` WRITE;
/*!40000 ALTER TABLE `test_plan_activity` DISABLE KEYS */;
INSERT INTO `test_plan_activity` VALUES (2,1,3,'2008-05-15 14:49:31','1','0'),(1,1,3,'2008-05-15 14:49:51','1','0'),(1,1,3,'2008-05-15 14:50:06','0','1');
/*!40000 ALTER TABLE `test_plan_activity` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `test_plan_attachments`
--

DROP TABLE IF EXISTS `test_plan_attachments`;
CREATE TABLE `test_plan_attachments` (
  `attachment_id` int(11) NOT NULL,
  `plan_id` int(11) NOT NULL,
  KEY `test_plan_attachments_primary_idx` (`attachment_id`),
  KEY `attachment_plan_id_idx` (`plan_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Dumping data for table `test_plan_attachments`
--

LOCK TABLES `test_plan_attachments` WRITE;
/*!40000 ALTER TABLE `test_plan_attachments` DISABLE KEYS */;
INSERT INTO `test_plan_attachments` VALUES (1,1),(2,1);
/*!40000 ALTER TABLE `test_plan_attachments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `test_plan_permissions`
--

DROP TABLE IF EXISTS `test_plan_permissions`;
CREATE TABLE `test_plan_permissions` (
  `userid` mediumint(9) NOT NULL,
  `plan_id` int(11) NOT NULL,
  `permissions` tinyint(4) NOT NULL,
  `grant_type` tinyint(4) NOT NULL,
  UNIQUE KEY `testers_plan_user_idx` (`userid`,`plan_id`,`grant_type`),
  KEY `testers_plan_user_plan_idx` (`plan_id`),
  KEY `testers_plan_grant_idx` (`grant_type`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Dumping data for table `test_plan_permissions`
--

LOCK TABLES `test_plan_permissions` WRITE;
/*!40000 ALTER TABLE `test_plan_permissions` DISABLE KEYS */;
INSERT INTO `test_plan_permissions` VALUES (1,1,15,0),(1,2,15,0),(1,3,15,0);
/*!40000 ALTER TABLE `test_plan_permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `test_plan_permissions_regexp`
--

DROP TABLE IF EXISTS `test_plan_permissions_regexp`;
CREATE TABLE `test_plan_permissions_regexp` (
  `plan_id` int(11) NOT NULL,
  `user_regexp` text NOT NULL,
  `permissions` tinyint(4) NOT NULL,
  UNIQUE KEY `testers_plan_regexp_idx` (`plan_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Dumping data for table `test_plan_permissions_regexp`
--

LOCK TABLES `test_plan_permissions_regexp` WRITE;
/*!40000 ALTER TABLE `test_plan_permissions_regexp` DISABLE KEYS */;
/*!40000 ALTER TABLE `test_plan_permissions_regexp` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `test_plan_tags`
--

DROP TABLE IF EXISTS `test_plan_tags`;
CREATE TABLE `test_plan_tags` (
  `tag_id` int(11) NOT NULL,
  `plan_id` int(11) NOT NULL,
  `userid` mediumint(9) NOT NULL,
  UNIQUE KEY `plan_tags_primary_idx` (`tag_id`,`plan_id`,`userid`),
  UNIQUE KEY `plan_tags_secondary_idx` (`tag_id`,`plan_id`),
  KEY `plan_tags_plan_id_idx` (`plan_id`),
  KEY `plan_tags_userid_idx` (`userid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Dumping data for table `test_plan_tags`
--

LOCK TABLES `test_plan_tags` WRITE;
/*!40000 ALTER TABLE `test_plan_tags` DISABLE KEYS */;
INSERT INTO `test_plan_tags` VALUES (1,1,1);
/*!40000 ALTER TABLE `test_plan_tags` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `test_plan_texts`
--

DROP TABLE IF EXISTS `test_plan_texts`;
CREATE TABLE `test_plan_texts` (
  `plan_id` int(11) NOT NULL,
  `plan_text_version` int(11) NOT NULL,
  `who` mediumint(9) NOT NULL,
  `creation_ts` datetime NOT NULL,
  `plan_text` mediumtext,
  KEY `test_plan_text_version_idx` (`plan_id`,`plan_text_version`),
  KEY `test_plan_text_who_idx` (`who`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Dumping data for table `test_plan_texts`
--

LOCK TABLES `test_plan_texts` WRITE;
/*!40000 ALTER TABLE `test_plan_texts` DISABLE KEYS */;
INSERT INTO `test_plan_texts` VALUES (1,1,1,'2008-03-17 16:51:01','&nbsp;This is a public test plan<br>'),(2,1,1,'2008-03-17 16:52:14','&nbsp;This is a PRIVATE test plan<br>'),(3,1,1,'2008-03-17 16:53:29','&nbsp;This is a PARTNER plan<br>'),(1,2,1,'2008-05-01 17:08:47','&nbsp;<b>This is a public test plan<br></b>\n<br>Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Nam\npellentesque odio et elit. Nam lobortis sem suscipit sapien. Sed\niaculis aliquam sapien. Maecenas ut lectus. Aenean fringilla massa et\nmetus. Nam varius, sapien nec egestas feugiat, mi libero dignissim\norci, id fermentum quam nisl quis risus. Phasellus libero justo,\naliquet quis, pellentesque vitae, porttitor quis, orci. Maecenas\nsollicitudin. Donec bibendum, ante quis sodales fermentum, quam risus\nplacerat pede, nec aliquam lorem odio sit amet nisi. Ut sem tellus,\nfeugiat vitae, lobortis nec, dapibus at, est. Aenean cursus. Vivamus\nfaucibus lectus eget felis. Nullam commodo tortor vitae turpis.\n<div id=\"lipsum\">\n<p>Sed mollis interdum risus. Pellentesque ante velit, facilisis vitae,\nfermentum eu, feugiat sit amet, dui. Suspendisse tempus ullamcorper\nnisl. Suspendisse ullamcorper, velit non luctus gravida, massa turpis\nullamcorper eros, sed dictum risus neque ut augue. Vestibulum neque\nnulla, pretium fermentum, rutrum vehicula, pulvinar at, est. Quisque\ndignissim. Nullam placerat neque vel urna. Quisque cursus lacus rutrum\ntortor. Nunc ut elit. Vestibulum mi nunc, volutpat id, tempor ut,\nscelerisque vel, magna. Aenean nisl nulla, rutrum sit amet,\nsollicitudin sed, molestie eget, nisi. Lorem ipsum dolor sit amet,\nconsectetuer adipiscing elit. Class aptent taciti sociosqu ad litora\ntorquent per conubia nostra, per inceptos himenaeos. In odio erat,\nbibendum eu, gravida nec, elementum sed, urna.\n</p>\n<p>Aliquam ultricies viverra mi. Ut convallis urna quis urna. Sed sed\ntortor. Suspendisse quis tellus. Ut gravida. Ut facilisis lectus in\npurus. Sed at est non libero dignissim varius. Donec vestibulum odio ac\nfelis. Duis interdum pellentesque nisl. Aenean leo. Curabitur lectus.\nCum sociis natoque penatibus et magnis dis parturient montes, nascetur\nridiculus mus. Duis nisl ligula, elementum vitae, posuere eu, semper\neget, augue. Maecenas metus nulla, ullamcorper id, malesuada sit amet,\nmattis nec, lacus. Nam tortor.\n</p>\n<p>Nam sollicitudin, lacus sit amet aliquam tempus, nulla tellus tempus\nvelit, eu sollicitudin dolor dui et velit. In ac sem. Mauris adipiscing\nenim in felis. Morbi porttitor laoreet sapien. Nam felis dolor, laoreet\nsed, iaculis eu, vulputate eu, nunc. Nullam egestas ligula. Fusce ut\nsapien. Aliquam erat volutpat. Proin tristique scelerisque sem. Nullam\nnon erat.\n</p>\n<p>Sed feugiat, lacus in elementum egestas, sapien nulla sodales leo,\nnec scelerisque diam eros eu arcu. Phasellus ut magna. Cras dignissim\npellentesque tellus. Curabitur sapien. Suspendisse a risus lobortis\nquam consectetuer placerat. Aliquam ultricies pretium tortor. Aliquam\nerat volutpat. Mauris nunc. Etiam vitae diam. Aenean a felis. Donec\nposuere, lacus in lacinia commodo, ligula lectus rutrum nibh, non\ndapibus sapien enim eu mauris. Pellentesque arcu risus, condimentum id,\ndapibus in, blandit ut, pede. Nulla facilisi. Vestibulum elit quam,\nfringilla convallis, congue lacinia, dictum at, velit. Vestibulum ante\nipsum primis in faucibus orci luctus et ultrices posuere cubilia Curae;\nSed augue mauris, commodo vel, tincidunt hendrerit, consectetuer eu,\neros.\n</p></div><br>');
/*!40000 ALTER TABLE `test_plan_texts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `test_plan_types`
--

DROP TABLE IF EXISTS `test_plan_types`;
CREATE TABLE `test_plan_types` (
  `type_id` smallint(6) NOT NULL auto_increment,
  `name` varchar(64) NOT NULL,
  `description` mediumtext,
  PRIMARY KEY  (`type_id`)
) ENGINE=MyISAM AUTO_INCREMENT=10 DEFAULT CHARSET=utf8;

--
-- Dumping data for table `test_plan_types`
--

LOCK TABLES `test_plan_types` WRITE;
/*!40000 ALTER TABLE `test_plan_types` DISABLE KEYS */;
INSERT INTO `test_plan_types` VALUES (1,'Unit',NULL),(2,'Integration',NULL),(3,'Function',NULL),(4,'System',NULL),(5,'Acceptance',NULL),(6,'Installation',NULL),(7,'Performance',NULL),(8,'Product',NULL),(9,'Interoperability',NULL);
/*!40000 ALTER TABLE `test_plan_types` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `test_plans`
--

DROP TABLE IF EXISTS `test_plans`;
CREATE TABLE `test_plans` (
  `plan_id` int(11) NOT NULL auto_increment,
  `product_id` smallint(6) NOT NULL,
  `author_id` mediumint(9) NOT NULL,
  `type_id` tinyint(4) NOT NULL,
  `default_product_version` mediumtext NOT NULL,
  `name` varchar(255) NOT NULL,
  `creation_date` datetime NOT NULL,
  `isactive` tinyint(4) NOT NULL default '1',
  PRIMARY KEY  (`plan_id`),
  KEY `plan_product_plan_id_idx` (`product_id`,`plan_id`),
  KEY `plan_author_idx` (`author_id`),
  KEY `plan_type_idx` (`type_id`),
  KEY `plan_isactive_idx` (`isactive`),
  KEY `plan_name_idx` (`name`)
) ENGINE=MyISAM AUTO_INCREMENT=4 DEFAULT CHARSET=utf8;

--
-- Dumping data for table `test_plans`
--

LOCK TABLES `test_plans` WRITE;
/*!40000 ALTER TABLE `test_plans` DISABLE KEYS */;
INSERT INTO `test_plans` VALUES (1,1,1,8,'PUBLIC v1','PUBLIC PLAN 1','2008-03-17 16:51:01',1),(2,2,1,8,'PRIVATE v2','PRIVATE PLAN 1','2008-03-17 16:52:14',0),(3,3,1,8,'PARTNER v1','PARTNER PLAN 1','2008-03-17 16:53:29',1);
/*!40000 ALTER TABLE `test_plans` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `test_relationships`
--

DROP TABLE IF EXISTS `test_relationships`;
CREATE TABLE `test_relationships` (
  `relationship_id` tinyint(4) NOT NULL,
  `name` varchar(50) default NULL,
  PRIMARY KEY  (`relationship_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Dumping data for table `test_relationships`
--

LOCK TABLES `test_relationships` WRITE;
/*!40000 ALTER TABLE `test_relationships` DISABLE KEYS */;
/*!40000 ALTER TABLE `test_relationships` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `test_run_activity`
--

DROP TABLE IF EXISTS `test_run_activity`;
CREATE TABLE `test_run_activity` (
  `run_id` int(11) NOT NULL,
  `fieldid` smallint(6) NOT NULL,
  `who` mediumint(9) NOT NULL,
  `changed` datetime NOT NULL,
  `oldvalue` mediumtext,
  `newvalue` mediumtext,
  KEY `run_activity_run_id_idx` (`run_id`),
  KEY `run_activity_field_idx` (`fieldid`),
  KEY `run_activity_who_idx` (`who`),
  KEY `run_activity_when_idx` (`changed`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Dumping data for table `test_run_activity`
--

LOCK TABLES `test_run_activity` WRITE;
/*!40000 ALTER TABLE `test_run_activity` DISABLE KEYS */;
/*!40000 ALTER TABLE `test_run_activity` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `test_run_cc`
--

DROP TABLE IF EXISTS `test_run_cc`;
CREATE TABLE `test_run_cc` (
  `run_id` int(11) NOT NULL,
  `who` mediumint(9) NOT NULL,
  UNIQUE KEY `test_run_cc_primary_idx` (`run_id`,`who`),
  KEY `test_run_cc_who_idx` (`who`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Dumping data for table `test_run_cc`
--

LOCK TABLES `test_run_cc` WRITE;
/*!40000 ALTER TABLE `test_run_cc` DISABLE KEYS */;
/*!40000 ALTER TABLE `test_run_cc` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `test_run_tags`
--

DROP TABLE IF EXISTS `test_run_tags`;
CREATE TABLE `test_run_tags` (
  `tag_id` int(11) NOT NULL,
  `run_id` int(11) NOT NULL,
  `userid` mediumint(9) NOT NULL,
  UNIQUE KEY `run_tags_primary_idx` (`tag_id`,`run_id`,`userid`),
  UNIQUE KEY `run_tags_secondary_idx` (`tag_id`,`run_id`),
  KEY `run_tags_run_id_idx` (`run_id`),
  KEY `run_tags_userid_idx` (`userid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Dumping data for table `test_run_tags`
--

LOCK TABLES `test_run_tags` WRITE;
/*!40000 ALTER TABLE `test_run_tags` DISABLE KEYS */;
INSERT INTO `test_run_tags` VALUES (3,3,1);
/*!40000 ALTER TABLE `test_run_tags` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `test_runs`
--

DROP TABLE IF EXISTS `test_runs`;
CREATE TABLE `test_runs` (
  `run_id` int(11) NOT NULL auto_increment,
  `plan_id` int(11) NOT NULL,
  `environment_id` int(11) NOT NULL,
  `product_version` mediumtext,
  `build_id` int(11) NOT NULL,
  `plan_text_version` int(11) NOT NULL,
  `manager_id` mediumint(9) NOT NULL,
  `default_tester_id` mediumint(9) default NULL,
  `start_date` datetime NOT NULL,
  `stop_date` datetime default NULL,
  `summary` tinytext NOT NULL,
  `notes` mediumtext,
  PRIMARY KEY  (`run_id`),
  KEY `test_run_plan_id_run_id_idx` (`plan_id`,`run_id`),
  KEY `test_run_manager_idx` (`manager_id`),
  KEY `test_run_start_date_idx` (`start_date`),
  KEY `test_run_stop_date_idx` (`stop_date`),
  KEY `test_run_env_idx` (`environment_id`),
  KEY `test_run_build_idx` (`build_id`),
  KEY `test_run_plan_ver_idx` (`plan_text_version`),
  KEY `test_run_tester_idx` (`default_tester_id`)
) ENGINE=MyISAM AUTO_INCREMENT=4 DEFAULT CHARSET=utf8;

--
-- Dumping data for table `test_runs`
--

LOCK TABLES `test_runs` WRITE;
/*!40000 ALTER TABLE `test_runs` DISABLE KEYS */;
INSERT INTO `test_runs` VALUES (1,1,3,'PUBLIC v1',4,1,5,NULL,'2008-04-17 09:54:24',NULL,'PUBLIC TEST RUN 1','PUBLIC TEST RUN 1'),(2,2,1,'PRIVATE v1',1,1,2,NULL,'2008-05-02 14:29:02',NULL,'PARTNER RUN','PARTNER RUN NOTES'),(3,2,2,'PRIVATE v2',2,1,2,NULL,'2008-05-02 14:29:18',NULL,'PARTNER RUN','PARTNER RUN NOTES');
/*!40000 ALTER TABLE `test_runs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `test_tags`
--

DROP TABLE IF EXISTS `test_tags`;
CREATE TABLE `test_tags` (
  `tag_id` int(11) NOT NULL auto_increment,
  `tag_name` varchar(255) NOT NULL,
  PRIMARY KEY  (`tag_id`),
  KEY `test_tag_name_idx_v2` (`tag_name`)
) ENGINE=MyISAM AUTO_INCREMENT=4 DEFAULT CHARSET=utf8;

--
-- Dumping data for table `test_tags`
--

LOCK TABLES `test_tags` WRITE;
/*!40000 ALTER TABLE `test_tags` DISABLE KEYS */;
INSERT INTO `test_tags` VALUES (1,'Public'),(2,'Private'),(3,'Partner');
/*!40000 ALTER TABLE `test_tags` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tokens`
--

DROP TABLE IF EXISTS `tokens`;
CREATE TABLE `tokens` (
  `userid` mediumint(9) default NULL,
  `issuedate` datetime NOT NULL,
  `token` varchar(16) NOT NULL,
  `tokentype` varchar(8) NOT NULL,
  `eventdata` tinytext,
  PRIMARY KEY  (`token`),
  KEY `tokens_userid_idx` (`userid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Dumping data for table `tokens`
--

LOCK TABLES `tokens` WRITE;
/*!40000 ALTER TABLE `tokens` DISABLE KEYS */;
INSERT INTO `tokens` VALUES (1,'2008-05-02 14:51:02','Zzog07sUwU','session','edit_group'),(1,'2008-05-02 14:51:33','gv3Cnn1YHG','session','edit_group'),(1,'2008-05-02 14:47:10','5Hc6oyGIoX','session','edit_user'),(1,'2008-05-02 14:47:08','OU0Fk0XmP2','session','edit_user'),(1,'2008-05-02 14:46:36','HGqWaqFjYv','session','edit_group'),(1,'2008-05-02 14:46:34','eKvbg8Ctde','session','edit_group'),(1,'2008-05-02 14:46:08','mioaP1BwE9','session','edit_user'),(1,'2008-05-02 14:45:48','VyKqtm1n14','session','edit_user'),(1,'2008-05-02 14:46:07','EfQ4HncVJI','session','edit_user'),(1,'2008-05-02 14:45:16','EuVzmBMNIP','session','edit_user'),(1,'2008-05-02 14:45:14','8A59PcqkAU','session','edit_user'),(1,'2008-05-02 14:45:07','eNUBOfAU3g','session','edit_user'),(1,'2008-05-02 14:45:06','jXHHM2xgGv','session','edit_user'),(1,'2008-05-02 14:44:50','bGXTZDkMrR','session','edit_user'),(1,'2008-05-02 14:44:42','qac4kmeRnn','session','edit_user'),(1,'2008-05-02 14:44:49','oonmgKM6Up','session','edit_user'),(1,'2008-05-02 14:44:31','8q3B4Ls9nI','session','edit_user'),(1,'2008-05-02 14:44:01','bx5POwjtfX','session','edit_user'),(1,'2008-05-02 14:44:29','CYL1QV0LVZ','session','edit_user'),(1,'2008-05-02 14:43:41','dmNHdSUzM9','session','edit_user'),(1,'2008-05-02 14:43:27','g8s0nUB0ys','session','edit_user'),(1,'2008-05-02 14:43:40','tUj6K7JMQX','session','edit_user'),(1,'2008-05-02 14:43:13','ABeKirlvVr','session','edit_user'),(1,'2008-05-02 14:42:52','ig1kaNGOt0','session','edit_user'),(1,'2008-05-02 14:43:11','35AW14OH17','session','edit_user'),(1,'2008-05-02 14:37:26','UojzfCQ4cq','session','edit_product'),(1,'2008-05-02 14:37:24','wzHivUGror','session','edit_product'),(1,'2008-05-02 14:37:14','nXMVzUPuzC','session','edit_product'),(1,'2008-05-02 14:37:12','DMyUzF5irS','session','edit_product'),(1,'2008-05-02 14:36:58','IdbtGEzC6T','session','edit_product'),(1,'2008-05-02 14:36:49','9A3HVCYod2','session','edit_group_controls'),(1,'2008-05-02 14:36:48','4BSWEvYiW1','session','edit_group_controls'),(1,'2008-05-02 14:36:45','zGpvba8saL','session','edit_product'),(1,'2008-05-02 14:36:44','jc9XK8DTf3','session','edit_product'),(1,'2008-05-02 14:33:49','u2NvNqrqeK','session','edit_group_controls'),(1,'2008-05-01 17:22:58','NlD32ZB5Jc','session','createbug:2'),(1,'2008-05-02 14:31:16','NTKyBgowwc','session','edit_product'),(1,'2008-05-02 14:31:17','8U7sSamWVd','session','edit_product'),(1,'2008-05-02 14:51:45','i2LheuBigV','session','edit_product'),(1,'2008-05-02 14:31:24','TAMHWO9GGS','session','edit_group_controls'),(1,'2008-05-02 14:51:46','rPYOLH1vpN','session','edit_product'),(1,'2008-05-02 14:52:09','GjEdx8s6OM','session','edit_group_controls'),(1,'2008-05-02 14:52:11','KsuUmfN4gR','session','edit_group_controls'),(1,'2008-05-02 15:01:22','pRJuLwYw21','session','edit_product'),(1,'2008-05-02 15:01:26','kdmDhrsu6s','session','edit_product'),(1,'2008-05-02 15:09:13','ERWmkpUOPF','session','createbug:3'),(1,'2008-05-02 15:12:40','8HYIPmGWgc','session','edit_group'),(1,'2008-05-02 15:12:42','RP12jUBF94','session','edit_group'),(1,'2008-05-02 15:13:11','9XM243wzya','session','edit_group'),(1,'2008-05-02 15:13:13','8D0fE2L5Km','session','edit_group'),(2,'2008-05-02 15:14:14','NdF08sPHDO','session','createbug:'),(1,'2008-05-02 15:14:49','9ibRoQm4Z2','session','edit_product'),(1,'2008-05-02 15:14:50','tGvDQ7xIqb','session','edit_product'),(1,'2008-05-02 15:15:32','EYZoBDiLSr','session','edit_group'),(1,'2008-05-02 15:15:08','b3viUsc6mm','session','edit_group'),(1,'2008-05-02 15:15:52','0YkcZVp6yg','session','edit_group'),(1,'2008-05-02 15:15:40','6gZDTD1r2M','session','edit_group'),(2,'2008-05-02 15:19:13','lYoujnHHxw','session','createbug:4'),(7,'2008-05-02 15:20:38','XYEf5r4pHB','session','createbug:5'),(3,'2008-05-02 15:26:26','Ko1sjx9tyG','session','createbug:6');
/*!40000 ALTER TABLE `tokens` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_group_map`
--

DROP TABLE IF EXISTS `user_group_map`;
CREATE TABLE `user_group_map` (
  `user_id` mediumint(9) NOT NULL,
  `group_id` mediumint(9) NOT NULL,
  `isbless` tinyint(4) NOT NULL default '0',
  `grant_type` tinyint(4) NOT NULL default '0',
  UNIQUE KEY `user_group_map_user_id_idx` (`user_id`,`group_id`,`grant_type`,`isbless`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Dumping data for table `user_group_map`
--

LOCK TABLES `user_group_map` WRITE;
/*!40000 ALTER TABLE `user_group_map` DISABLE KEYS */;
INSERT INTO `user_group_map` VALUES (1,1,0,0),(1,1,1,0),(1,2,0,0),(1,2,1,0),(1,4,0,0),(1,4,1,0),(1,9,0,2),(2,9,0,2),(2,15,0,0),(2,15,1,0),(3,1,0,0),(3,1,1,0),(3,9,0,2),(4,9,0,2),(5,9,0,2),(6,9,0,2),(6,15,0,0),(6,15,1,0),(7,9,0,2),(7,16,0,0),(7,16,1,0),(8,9,0,2),(8,16,0,0),(8,16,1,0);
/*!40000 ALTER TABLE `user_group_map` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `versions`
--

DROP TABLE IF EXISTS `versions`;
CREATE TABLE `versions` (
  `id` mediumint(9) NOT NULL auto_increment,
  `value` varchar(64) NOT NULL,
  `product_id` smallint(6) NOT NULL,
  `disallownew` tinyint(4) NOT NULL default '0',
  PRIMARY KEY  (`id`),
  UNIQUE KEY `versions_product_id_idx` (`product_id`,`value`)
) ENGINE=MyISAM AUTO_INCREMENT=8 DEFAULT CHARSET=utf8;

--
-- Dumping data for table `versions`
--

LOCK TABLES `versions` WRITE;
/*!40000 ALTER TABLE `versions` DISABLE KEYS */;
INSERT INTO `versions` VALUES (1,'PUBLIC v1',1,0),(2,'PRIVATE v1',2,0),(3,'PARTNER v1',3,0),(4,'PARTNER v2',3,0),(5,'PUBLIC v2',1,0),(6,'PUBLIC v3',1,0),(7,'PRIVATE v2',2,0);
/*!40000 ALTER TABLE `versions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `votes`
--

DROP TABLE IF EXISTS `votes`;
CREATE TABLE `votes` (
  `who` mediumint(9) NOT NULL,
  `bug_id` mediumint(9) NOT NULL,
  `vote_count` smallint(6) NOT NULL,
  KEY `votes_who_idx` (`who`),
  KEY `votes_bug_id_idx` (`bug_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Dumping data for table `votes`
--

LOCK TABLES `votes` WRITE;
/*!40000 ALTER TABLE `votes` DISABLE KEYS */;
/*!40000 ALTER TABLE `votes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `watch`
--

DROP TABLE IF EXISTS `watch`;
CREATE TABLE `watch` (
  `watcher` mediumint(9) NOT NULL,
  `watched` mediumint(9) NOT NULL,
  UNIQUE KEY `watch_watcher_idx` (`watcher`,`watched`),
  KEY `watch_watched_idx` (`watched`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Dumping data for table `watch`
--

LOCK TABLES `watch` WRITE;
/*!40000 ALTER TABLE `watch` DISABLE KEYS */;
/*!40000 ALTER TABLE `watch` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `whine_events`
--

DROP TABLE IF EXISTS `whine_events`;
CREATE TABLE `whine_events` (
  `id` mediumint(9) NOT NULL auto_increment,
  `owner_userid` mediumint(9) NOT NULL,
  `subject` varchar(128) default NULL,
  `body` mediumtext,
  PRIMARY KEY  (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Dumping data for table `whine_events`
--

LOCK TABLES `whine_events` WRITE;
/*!40000 ALTER TABLE `whine_events` DISABLE KEYS */;
/*!40000 ALTER TABLE `whine_events` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `whine_queries`
--

DROP TABLE IF EXISTS `whine_queries`;
CREATE TABLE `whine_queries` (
  `id` mediumint(9) NOT NULL auto_increment,
  `eventid` mediumint(9) NOT NULL,
  `query_name` varchar(64) NOT NULL default '',
  `sortkey` smallint(6) NOT NULL default '0',
  `onemailperbug` tinyint(4) NOT NULL default '0',
  `title` varchar(128) NOT NULL default '',
  PRIMARY KEY  (`id`),
  KEY `whine_queries_eventid_idx` (`eventid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Dumping data for table `whine_queries`
--

LOCK TABLES `whine_queries` WRITE;
/*!40000 ALTER TABLE `whine_queries` DISABLE KEYS */;
/*!40000 ALTER TABLE `whine_queries` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `whine_schedules`
--

DROP TABLE IF EXISTS `whine_schedules`;
CREATE TABLE `whine_schedules` (
  `id` mediumint(9) NOT NULL auto_increment,
  `eventid` mediumint(9) NOT NULL,
  `run_day` varchar(32) default NULL,
  `run_time` varchar(32) default NULL,
  `run_next` datetime default NULL,
  `mailto` mediumint(9) NOT NULL,
  `mailto_type` smallint(6) NOT NULL default '0',
  PRIMARY KEY  (`id`),
  KEY `whine_schedules_run_next_idx` (`run_next`),
  KEY `whine_schedules_eventid_idx` (`eventid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Dumping data for table `whine_schedules`
--

LOCK TABLES `whine_schedules` WRITE;
/*!40000 ALTER TABLE `whine_schedules` DISABLE KEYS */;
/*!40000 ALTER TABLE `whine_schedules` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2008-05-28 19:57:33
