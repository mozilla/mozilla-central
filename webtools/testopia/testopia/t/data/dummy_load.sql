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
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Dumping data for table `attachments`
--

LOCK TABLES `attachments` WRITE;
/*!40000 ALTER TABLE `attachments` DISABLE KEYS */;
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
) ENGINE=MyISAM AUTO_INCREMENT=2 DEFAULT CHARSET=utf8;

--
-- Dumping data for table `bugs`
--

LOCK TABLES `bugs` WRITE;
/*!40000 ALTER TABLE `bugs` DISABLE KEYS */;
INSERT INTO `bugs` VALUES (1,4,'','normal','NEW','2008-03-27 15:48:39','2008-03-27 15:48:39','PUBLIC VISIBLE BUG','Linux','P5',1,'PC',1,'PUBLIC v1',1,'','PUBLIC M1',5,'',0,'','2008-03-27 15:48:39',1,1,1,'0.00','0.00',NULL,NULL);
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
  PRIMARY KEY  (`id`),
  UNIQUE KEY `components_product_id_idx` (`product_id`,`name`),
  KEY `components_name_idx` (`name`)
) ENGINE=MyISAM AUTO_INCREMENT=5 DEFAULT CHARSET=utf8;

--
-- Dumping data for table `components`
--

LOCK TABLES `components` WRITE;
/*!40000 ALTER TABLE `components` DISABLE KEYS */;
INSERT INTO `components` VALUES (1,'PUBLIC ONE COMP 1',1,4,5,'PUBLIC ONE COMP 1'),(2,'PUBLIC ONE COMP 2',1,4,5,'PUBLIC ONE COMP 2'),(3,'PRIVATE ONE COMP 1',2,7,8,'PRIVATE ONE COMP 1'),(4,'PARTNER ONE COMP 1',3,2,6,'PARTNER ONE COMP 1');
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
INSERT INTO `group_control_map` VALUES (15,3,1,3,3,0,0,0,0);
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
INSERT INTO `group_group_map` VALUES (2,2,0),(2,2,1),(2,2,2),(2,3,0),(2,3,1),(2,3,2),(2,4,0),(2,4,1),(2,4,2),(2,5,0),(2,5,1),(2,5,2),(2,6,0),(2,6,1),(2,6,2),(2,7,0),(2,7,1),(2,7,2),(2,8,0),(2,8,1),(2,8,2),(2,9,0),(2,9,1),(2,9,2),(2,10,0),(2,10,1),(2,10,2),(2,11,0),(2,11,1),(2,11,2),(2,12,0),(2,12,1),(2,12,2),(2,13,0),(2,13,1),(2,13,2),(2,14,0),(2,14,1),(2,14,2),(2,15,0),(2,15,1),(2,15,2),(2,16,0),(2,16,1),(2,16,2),(12,14,0),(13,11,0);
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
INSERT INTO `logincookies` VALUES ('c5ubyZ2bCe',1,'137.65.15.210','2008-03-17 17:18:51'),('BmPBa5fs1k',1,'127.0.0.2','2008-04-04 13:49:18'),('JHjEVoE8qt',1,'127.0.0.2','2008-04-17 09:55:07');
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
) ENGINE=MyISAM AUTO_INCREMENT=2 DEFAULT CHARSET=utf8;

--
-- Dumping data for table `longdescs`
--

LOCK TABLES `longdescs` WRITE;
/*!40000 ALTER TABLE `longdescs` DISABLE KEYS */;
INSERT INTO `longdescs` VALUES (1,1,1,'2008-03-27 15:48:39','0.00','PUBLIC VISIBLE BUG - basic',0,0,0,NULL);
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
  PRIMARY KEY  (`id`),
  UNIQUE KEY `milestones_product_id_idx` (`product_id`,`value`)
) ENGINE=MyISAM AUTO_INCREMENT=7 DEFAULT CHARSET=utf8;

--
-- Dumping data for table `milestones`
--

LOCK TABLES `milestones` WRITE;
/*!40000 ALTER TABLE `milestones` DISABLE KEYS */;
INSERT INTO `milestones` VALUES (1,1,'PUBLIC M1',0),(2,2,'PRIVATE M1',0),(3,3,'PARTNER M1',0),(4,3,'PARTNER M2',0),(5,1,'PUBLIC M2',0),(6,2,'PRIVATE M2',0);
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
INSERT INTO `profiles_activity` VALUES (1,1,'2008-03-17 15:53:06',31,NULL,'2008-03-17 15:53:06'),(2,1,'2008-03-17 15:56:26',31,NULL,'2008-03-17 15:56:26'),(3,1,'2008-03-17 15:56:59',31,NULL,'2008-03-17 15:56:59'),(3,1,'2008-03-17 15:57:09',39,'','Testers'),(4,1,'2008-03-17 15:57:45',31,NULL,'2008-03-17 15:57:45'),(5,1,'2008-03-17 16:05:26',31,NULL,'2008-03-17 16:05:26'),(6,1,'2008-03-17 16:17:42',31,NULL,'2008-03-17 16:17:42'),(7,1,'2008-03-17 16:18:30',31,NULL,'2008-03-17 16:18:30'),(7,1,'2008-03-17 16:18:40',39,'','Testers'),(8,1,'2008-03-17 16:19:08',31,NULL,'2008-03-17 16:19:08'),(1,1,'2008-03-17 16:49:15',39,'','Testers');
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
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Dumping data for table `test_attachments`
--

LOCK TABLES `test_attachments` WRITE;
/*!40000 ALTER TABLE `test_attachments` DISABLE KEYS */;
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
) ENGINE=MyISAM AUTO_INCREMENT=6 DEFAULT CHARSET=utf8;

--
-- Dumping data for table `test_builds`
--

LOCK TABLES `test_builds` WRITE;
/*!40000 ALTER TABLE `test_builds` DISABLE KEYS */;
INSERT INTO `test_builds` VALUES (1,2,'PRIVATE M1','PRIVATE BUILD 1','',1),(2,2,'PRIVATE M1','PRIVATE BUILD 2','',1),(3,3,'PARTNER M1','PARTNER BUILD 1','',1),(4,1,'PUBLIC M1','PUBLIC BUILD 1','',1),(5,1,'PUBLIC M1','PUBLIC BUILD 2','',1);
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
) ENGINE=MyISAM AUTO_INCREMENT=5 DEFAULT CHARSET=utf8;

--
-- Dumping data for table `test_case_categories`
--

LOCK TABLES `test_case_categories` WRITE;
/*!40000 ALTER TABLE `test_case_categories` DISABLE KEYS */;
INSERT INTO `test_case_categories` VALUES (1,1,'PUBLIC CATEGORY 1','PUBLIC CATEGORY'),(2,2,'PRIVATE CATEGORY 1','PRIVATE CATEGORY'),(3,3,'PARTNER CATEGORY 1','PARTNER CATEGORY'),(4,3,'PARTNER CATEGORY 2','PARTNER CATEGORY');
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
INSERT INTO `test_case_plans` VALUES (1,1),(1,2),(1,3),(1,4);
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
) ENGINE=MyISAM AUTO_INCREMENT=2 DEFAULT CHARSET=utf8;

--
-- Dumping data for table `test_case_runs`
--

LOCK TABLES `test_case_runs` WRITE;
/*!40000 ALTER TABLE `test_case_runs` DISABLE KEYS */;
INSERT INTO `test_case_runs` VALUES (1,1,4,0,NULL,1,1,4,NULL,NULL,NULL,1,NULL,3);
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
INSERT INTO `test_case_texts` VALUES (1,1,1,'2008-04-16 13:57:05','<ol>\r\n  <li>PUBLIC TEST CASE 1 - PROPOSED</li><li>PUBLIC CATEGORY 1</li>\r\n</ol>','<ol>\r\n  <li></li>\r\n</ol>','',''),(2,1,1,'2008-04-16 14:01:58','<ol>\r\n  <li>PUBLIC TEST CASE 1 - PROPOSED</li><li>PUBLIC CATEGORY 1</li>\r\n</ol>','<ol>\r\n  <li></li>\r\n</ol>','',''),(3,1,1,'2008-04-16 14:02:11','<ol>\r\n  <li>PUBLIC TEST CASE 1 - PROPOSED</li><li>PUBLIC CATEGORY 1</li>\r\n</ol>','<ol>\r\n  <li></li>\r\n</ol>','',''),(4,1,1,'2008-04-17 09:51:33','<ol>\r\n  <li>PUBLIC TEST CASE - CONFIRMED P2<br></li>\r\n</ol>','<ol>\r\n  <li></li>\r\n</ol>','','');
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
) ENGINE=MyISAM AUTO_INCREMENT=5 DEFAULT CHARSET=utf8;

--
-- Dumping data for table `test_cases`
--

LOCK TABLES `test_cases` WRITE;
/*!40000 ALTER TABLE `test_cases` DISABLE KEYS */;
INSERT INTO `test_cases` VALUES (1,1,1,1,1,5,'2008-04-16 13:57:05','00:00:00',0,NULL,'','','PUBLIC TEST CASE 1 - PROPOSED','',NULL),(2,1,1,1,1,5,'2008-04-16 14:01:58','00:00:00',0,NULL,'','','PUBLIC TEST CASE 1 - PROPOSED','',NULL),(3,1,1,1,1,5,'2008-04-16 14:02:11','00:00:00',0,NULL,'','','PUBLIC TEST CASE 1 - PROPOSED','',NULL),(4,2,1,2,1,NULL,'2008-04-17 09:51:33','00:00:00',1,NULL,'PUBLIC SCRIPT','PUBLIC ARG','PUBLIC TEST CASE - CONFIRMED','PUBLIC REQUIREMENT 1',NULL);
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
) ENGINE=MyISAM AUTO_INCREMENT=3 DEFAULT CHARSET=utf8;

--
-- Dumping data for table `test_environment_category`
--

LOCK TABLES `test_environment_category` WRITE;
/*!40000 ALTER TABLE `test_environment_category` DISABLE KEYS */;
INSERT INTO `test_environment_category` VALUES (1,0,'Operating System'),(2,0,'Hardware');
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
) ENGINE=MyISAM AUTO_INCREMENT=10 DEFAULT CHARSET=utf8;

--
-- Dumping data for table `test_environment_element`
--

LOCK TABLES `test_environment_element` WRITE;
/*!40000 ALTER TABLE `test_environment_element` DISABLE KEYS */;
INSERT INTO `test_environment_element` VALUES (1,1,'All',0,0),(2,1,'Linux',0,0),(3,1,'Mac OS',0,0),(4,1,'Other',0,0),(5,1,'Windows',0,0),(6,2,'All',0,0),(7,2,'Macintosh',0,0),(8,2,'Other',0,0),(9,2,'PC',0,0);
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
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Dumping data for table `test_environment_property`
--

LOCK TABLES `test_environment_property` WRITE;
/*!40000 ALTER TABLE `test_environment_property` DISABLE KEYS */;
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
) ENGINE=MyISAM AUTO_INCREMENT=5 DEFAULT CHARSET=utf8;

--
-- Dumping data for table `test_environments`
--

LOCK TABLES `test_environments` WRITE;
/*!40000 ALTER TABLE `test_environments` DISABLE KEYS */;
INSERT INTO `test_environments` VALUES (1,2,'PRIVATE ENVIRONMENT 1',1),(2,2,'PRIVATE ENVIRONMENT 2',1),(3,1,'PUBLIC ENVIRONMENT 1',1),(4,3,'PARTNER ENVIRONMENT',1);
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
INSERT INTO `test_named_queries` VALUES (1,'__plan__',0,'1,2,3',0),(1,'__environment__',0,'3',0),(1,'__case__',0,'4',0),(1,'__run__',0,'1',0);
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
INSERT INTO `test_plan_texts` VALUES (1,1,1,'2008-03-17 16:51:01','&nbsp;This is a public test plan<br>'),(2,1,1,'2008-03-17 16:52:14','&nbsp;This is a PRIVATE test plan<br>'),(3,1,1,'2008-03-17 16:53:29','&nbsp;This is a PARTNER plan<br>');
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
INSERT INTO `test_plans` VALUES (1,1,1,8,'PUBLIC v1','PUBLIC PLAN 1','2008-03-17 16:51:01',1),(2,2,1,8,'PRIVATE v2','PRIVATE PLAN 1','2008-03-17 16:52:14',1),(3,3,1,8,'PARTNER v1','PARTNER PLAN 1','2008-03-17 16:53:29',1);
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
) ENGINE=MyISAM AUTO_INCREMENT=2 DEFAULT CHARSET=utf8;

--
-- Dumping data for table `test_runs`
--

LOCK TABLES `test_runs` WRITE;
/*!40000 ALTER TABLE `test_runs` DISABLE KEYS */;
INSERT INTO `test_runs` VALUES (1,1,3,'PUBLIC v1',4,1,5,NULL,'2008-04-17 09:54:24',NULL,'PUBLIC TEST RUN 1','PUBLIC TEST RUN 1');
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
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

--
-- Dumping data for table `test_tags`
--

LOCK TABLES `test_tags` WRITE;
/*!40000 ALTER TABLE `test_tags` DISABLE KEYS */;
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
INSERT INTO `tokens` VALUES (1,'2008-03-17 15:54:46','7izc6f7MyO','session','edit_parameters'),(1,'2008-03-17 15:55:14','i6J0YnByNf','session','edit_parameters'),(1,'2008-03-17 15:56:26','IYf64TBS3o','session','edit_user'),(1,'2008-03-17 15:57:09','2aJAbAQBSH','session','edit_user'),(1,'2008-03-17 15:57:46','3HJF46Htw2','session','edit_user'),(1,'2008-03-17 15:59:10','aE371xcIyH','session','edit_parameters'),(1,'2008-03-17 15:59:47','PTx5L9HDEG','session','edit_parameters'),(1,'2008-03-17 16:03:07','T1Z7lZEJxx','session','edit_product'),(1,'2008-03-17 16:09:22','I0v2SeuvTU','session','edit_classification'),(1,'2008-03-17 16:05:26','rVUN76txRK','session','edit_user'),(1,'2008-03-17 16:09:51','3doc4EVgO8','session','edit_classification'),(1,'2008-03-17 16:10:23','xjz71XeqQx','session','add_product'),(1,'2008-03-17 16:10:54','XaZwpcLjhP','session','reclassify_classifications'),(1,'2008-03-17 16:11:02','xNQmoHMlCx','session','edit_classification'),(1,'2008-03-17 16:20:18','NITvi2yLeA','session','edit_classification'),(1,'2008-03-17 16:17:42','zknLHnh1hK','session','edit_user'),(1,'2008-03-17 16:18:40','bSE88fZPsi','session','edit_user'),(1,'2008-03-17 16:19:08','oJHfqeVRqR','session','edit_user'),(1,'2008-03-17 16:21:35','HxkgbnZpPE','session','edit_product'),(1,'2008-03-17 16:31:42','hWKk5UnWMR','session','add_component'),(1,'2008-03-17 16:31:57','9nim2ZdyAV','session','edit_product'),(1,'2008-03-17 16:32:08','WSgTcQqDZX','session','delete_version'),(1,'2008-03-17 16:32:53','1EdKItWJL4','session','edit_product'),(1,'2008-03-17 16:33:06','8OfekLXTNp','session','add_milestone'),(1,'2008-03-17 16:34:00','cpTraoiIvA','session','edit_product'),(1,'2008-03-17 16:34:52','QOI0KlCXco','session','edit_product'),(1,'2008-03-17 16:37:32','p9kU80xiNb','session','edit_product'),(1,'2008-03-17 16:38:14','FJynG6qeqt','session','edit_product'),(1,'2008-03-17 16:38:32','gCdo8DKsuf','session','edit_product'),(1,'2008-03-17 16:45:02','LEXbL7RPvV','session','edit_product'),(1,'2008-03-17 16:49:15','oR4taQOlJ4','session','edit_user'),(1,'2008-03-27 15:47:53','WDgd2h8Aot','session','createbug:1'),(1,'2008-04-04 10:19:14','g2zwqmhB6e','session','edit_classification'),(1,'2008-04-04 10:21:28','7IM5g1qbMh','session','edit_product'),(1,'2008-04-04 10:25:09','wsYMWwGyah','session','edit_parameters'),(1,'2008-04-04 10:25:38','91ikWHEKxe','session','edit_parameters'),(1,'2008-04-04 10:25:55','HQkWJ66Meb','session','edit_parameters'),(1,'2008-04-04 10:34:13','2ZbSonSqN6','session','edit_parameters');
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
INSERT INTO `user_group_map` VALUES (1,1,0,0),(1,1,1,0),(1,2,0,0),(1,2,1,0),(1,4,0,0),(1,9,0,2),(2,9,0,2),(3,1,0,0),(3,1,1,0),(3,9,0,2),(4,9,0,2),(5,9,0,2),(6,9,0,2),(7,1,0,0),(7,1,1,0),(7,9,0,2),(8,9,0,2);
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
  PRIMARY KEY  (`id`),
  UNIQUE KEY `versions_product_id_idx` (`product_id`,`value`)
) ENGINE=MyISAM AUTO_INCREMENT=8 DEFAULT CHARSET=utf8;

--
-- Dumping data for table `versions`
--

LOCK TABLES `versions` WRITE;
/*!40000 ALTER TABLE `versions` DISABLE KEYS */;
INSERT INTO `versions` VALUES (1,'PUBLIC v1',1),(2,'PRIVATE v1',2),(3,'PARTNER v1',3),(4,'PARTNER v2',3),(5,'PUBLIC v2',1),(6,'PUBLIC v3',1),(7,'PRIVATE v2',2);
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

-- Dump completed on 2008-04-21 18:49:31
