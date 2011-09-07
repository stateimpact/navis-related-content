<?php
/***
 * Plugin Name: Navis Related Content
 * Description: Package related stories into a pleasant chunk of content
 * Version: 0.1
 * Author: Chris Amico
 * License: GPLv2
***/
/*
    Copyright 2011 National Public Radio, Inc. 

    This program is free software; you can redistribute it and/or modify
    it under the terms of the GNU General Public License, version 2, as 
    published by the Free Software Foundation.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program; if not, write to the Free Software
    Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA
*/

class Navis_Related_Content {
    
    function __construct() {
        
        // add ajax hook to get posts
        // add admin js
        // add tinymce plugin
        // save metadata to custom post type
    }
    
    function create_post_type() {
        
    }
    
    function register_tinymce_filters() {
        add_filter('mce_external_plugins', 
            array(&$this, 'add_tinymce_plugin')
        );
        add_filter('mce_buttons', 
            array(&$this, 'register_button')
        );
    }
    
    function add_tinymce_plugin($plugin_array) {
        $plugin_array['related_content'] = plugins_url(
            'js/tinymce/related-content.js', __FILE__);
        return $plugin_array;
    }
    
    function register_button($buttons) {
        array_push($buttons, '|', "related_content");
        return $buttons;
    }
    
    function query( $args = array() ) {
        // borrowed rather shamelessly from wordpress itself
        // wp-admin/includes/internal-linking.php
        $pts = get_post_types( array( 'public' => true ), 'objects' );
    	$pt_names = array_keys( $pts );

    	$query = array(
    		'post_type' => $pt_names,
    		'suppress_filters' => true,
    		'update_post_term_cache' => false,
    		'update_post_meta_cache' => false,
    		'post_status' => 'publish',
    		'order' => 'DESC',
    		'orderby' => 'post_date',
    		'posts_per_page' => 20,
    	);

    	$args['pagenum'] = isset( $args['pagenum'] ) ? absint( $args['pagenum'] ) : 1;

    	if ( isset( $args['s'] ) )
    		$query['s'] = $args['s'];

    	$query['offset'] = $args['pagenum'] > 1 ? $query['posts_per_page'] * ( $args['pagenum'] - 1 ) : 0;

    	// Do main query.
    	$get_posts = new WP_Query;
    	$posts = $get_posts->query( $query );
    	// Check if any posts were found.
    	if ( ! $get_posts->post_count )
    		return false;

    	// Build results.
    	$results = array();
    	foreach ( $posts as $post ) {
    		if ( 'post' == $post->post_type )
    			$info = mysql2date( __( 'Y/m/d' ), $post->post_date );
    		else
    			$info = $pts[ $post->post_type ]->labels->singular_name;

    		$results[] = array(
    			'ID' => $post->ID,
    			'title' => trim( esc_html( strip_tags( get_the_title( $post ) ) ) ),
    			'permalink' => get_permalink( $post->ID ),
    			'info' => $info,
    		);
    	}

    	return $results;
    }
    
    function ajax_save( $args = array() ) {
        
    }
    
    function shortcode($atts, $content = null) {
        
    }
    
    function admin_stylesheet() {
        
    }
    
    function admin_js() {
        
    }
}

$navis_related_content = new Navis_Related_Content;

?>