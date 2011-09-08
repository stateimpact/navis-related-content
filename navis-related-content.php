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
        add_action('init', array(&$this, 'create_post_type'));
        add_action('init', array(&$this, 'register_tinymce_filters'));
        
        add_action('wp_ajax_related_content_form',
            array(&$this, 'ajax_render_form'));
        add_action('wp_ajax_fetch_related_content',
            array(&$this, 'ajax_fetch'));
        add_action('wp_ajax_save_related_content',
            array(&$this, 'ajax_save'));
        
        add_action( 
            'admin_print_styles-post.php', 
            array( &$this, 'add_stylesheet' ) 
        );
        add_action( 
            'admin_print_styles-post-new.php', 
            array( &$this, 'add_stylesheet' ) 
        );
        
        add_action( 'admin_print_scripts-post.php', 
            array( &$this, 'register_admin_scripts' )
        );
        add_action( 'admin_print_scripts-post-new.php', 
            array( &$this, 'register_admin_scripts' )
        );
        
        add_shortcode('spreadsheet', array(&$this, 'shortcode'));
        
    }
    
    function create_post_type() {
        register_post_type('related_content_module', array(
            'public'   => false,
            'supports' => array('title')
        ));
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

    		$data = array(
    			'ID' => $post->ID,
    			'title' => trim( esc_html( strip_tags( get_the_title( $post ) ) ) ),
    			'permalink' => get_permalink( $post->ID ),
    			'info' => $info,
    		);
    		
    		if (has_post_thumbnail($post->ID)) {
    		    $data['thumbnail'] = wp_get_attachment_image_src(
    		        get_the_post_thumbnail_id($post->ID), 'thumbnail');
    		}
    		
    		$results[] = $data;
    	}

    	return $results;
    }
    
    function ajax_render_form() { ?>
        <form id="navis-related-content-form" tabindex="-1">
        <?php wp_nonce_field( 'navis-related-content-form', '_navis_related_content_nonce', true ); ?>
        <div id="link-selector">
        	<div id="link-options">
        		<p class="howto"><?php _e( 'Enter the destination URL' ); ?></p>
        		<div>
        			<label><span><?php _e( 'URL' ); ?></span><input id="url-field" type="text" tabindex="10" name="href" /></label>
        		</div>
        		<div>
        			<label><span><?php _e( 'Title' ); ?></span><input id="link-title-field" type="text" tabindex="20" name="linktitle" /></label>
        		</div>
        	</div>
        	<p class="howto">Link to recent content</p>
        	<div id="search-panel">
        		<div class="link-search-wrapper">
        			<label>
        				<span><?php _e( 'Search' ); ?></span>
        				<input type="text" id="search-field" class="link-search-field" tabindex="60" autocomplete="off" />
        				<img class="waiting" src="<?php echo esc_url( admin_url( 'images/wpspin_light.gif' ) ); ?>" alt="" />
        			</label>
        		</div>
        		<div id="search-results" class="query-results">
        			<ul></ul>
        			<div class="river-waiting">
        				<img class="waiting" src="<?php echo esc_url( admin_url( 'images/wpspin_light.gif' ) ); ?>" alt="" />
        			</div>
        		</div>
        		<div id="most-recent-results" class="query-results">
        			<div class="query-notice"><em><?php _e( 'No search term specified. Showing recent items.' ); ?></em></div>
        			<ul></ul>
        			<div class="river-waiting">
        				<img class="waiting" src="<?php echo esc_url( admin_url( 'images/wpspin_light.gif' ) ); ?>" alt="" />
        			</div>
        		</div>
        	</div>
        </div>
        </form>
        <?php
        die();
    }
    
    function ajax_fetch() {
        
        die();
    }
    
    function ajax_save( $args = array() ) {
        
        die();
    }
    
    function shortcode($atts, $content = null) {
        
        return "";
    }
    
    function add_stylesheet() {
        $css = plugins_url( 'css/related-content.css', __FILE__ );
        wp_enqueue_style('wp-jquery-ui-dialog');
        wp_enqueue_style(
            'navis-related-content', $css, array(), '0.1'
        );
    }
    
    function register_admin_scripts() {
        $jslibs = array(
            'underscore' => plugins_url('js/underscore-min.js', __FILE__),
            'backbone' => plugins_url('js/backbone-min.js', __FILE__),
            'related-content' => plugins_url('js/related-content.js', __FILE__),
        );
        
        wp_enqueue_script( 'underscore', $jslibs['underscore']);
        wp_enqueue_script( 'backbone', $jslibs['backbone'],
            array('underscore', 'jquery'));
        wp_enqueue_script( 'related-content', $jslibs['related-content'],
            array('jquery', 'underscore', 'backbone'),
            "0.1");
        
    }
}

$navis_related_content = new Navis_Related_Content;

?>