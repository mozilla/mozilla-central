<?php
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is addons.mozilla.org site.
 *
 * The Initial Developer of the Original Code is
 * Mozilla Corporation.
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Frederic Wenzel <fwenzel@mozilla.com> (Original Author)
 *   Mike Morgan <morgamic@mozilla.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

/**
 * This model is an interface to Memcache.
 * It's called Memcaching to not interfere with the actual Memcache class.
 */
class Memcaching {
    var $cache;             // holds the memcache object
    var $memcacheConnected; // did we find a valid memcache server?

    function Memcaching() {
        global $memcache_config;

        if (class_exists('Memcache') && defined('MEMCACHE_ON') && MEMCACHE_ON)
            $this->cache = new Memcache();
        else
            return false;

        if (defined('MEMCACHE_NAMESPACE')) 
            $this->namespace = MEMCACHE_NAMESPACE;
        else
            $this->namespace = '';

        if (is_array($memcache_config)) {
            foreach ($memcache_config as $host=>$options) {
                if ($this->cache->addServer($host, $options['port'], $options['persistent'], $options['weight'], $options['timeout'], $options['retry_interval'])) {
                    $this->memcacheConnected = true;
                }
            }
        }

        if (!$this->memcacheConnected)
            error_log('Memcache Error: Unable connect to memcache server.  Please check configuration and try again.');
    }

    /**
     * Get an item from the cache, if it exists
     * @return mixed item if found, else false
     */
    function get($key) {
        if (!$this->memcacheConnected) return false;
        return $this->cache->get($this->namespaceKey($key));
    }

    /**
     * Store an item in the cache. Replaces an existing item.
     * @return bool success
     */
    function set($key, $var, $flag = null, $expire = MEMCACHE_EXPIRE) {
        if (!$this->memcacheConnected) return false;
        return $this->cache->set($this->namespaceKey($key), $var, $flag, $expire);
    }
    
    /**
     * Store an item in the cache. Returns false if the key is
     * already present in the cache.
     * @return bool success
     */
    function add($key, $var, $flag = null, $expire = MEMCACHE_EXPIRE) {
        if (!$this->memcacheConnected) return false;
        return $this->cache->add($this->namespaceKey($key), $var, $flag, $expire);
    }

    /**
     * Store an item in the cache. Returns false if the key did
     * NOT exist in the cache before.
     * @return bool success
     */
    function replace($key, $var, $flag = null, $expire = MEMCACHE_EXPIRE) {
        if (!$this->memcacheConnected) return false;
        return $this->cache->replace($this->namespaceKey($key), $var, $flag, $expire);
    }

    /**
     * Close the connection to _ALL_ cache servers
     * @return bool success
     */
    function close() {
        if (!$this->memcacheConnected) return false;
        return $this->cache->close();
    }

    /**
     * Delete something off the cache
     * @return bool success
     */
    function delete($key, $timeout = null) {
        if (!$this->memcacheConnected) return false;
        return $this->cache->delete($this->namespaceKey($key), $timeout);
    }

    /**
     * Returns key in the appropriate namespace.
     * @param string $key memcache key 
     * @return string Namespaced key
     */
     function namespaceKey($key) {
        return $this->namespace . $key;
     }

    /**
     * Flush the cache
     * @return bool success
     */
    function flush() {
        if (!$this->memcacheConnected) return false;
        return $this->cache->flush();
    }

    /**
     * Get server statistics.
     * return array
     */
    function getExtendedStats() {
        if (!$this->memcacheConnected) return false;
        return $this->cache->getExtendedStats();
    }
}
?>
