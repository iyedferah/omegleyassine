<?php
/**
 * Functions and definitions for Omegle WP Theme (Flat Structure)
 */

function omegle_wp_enqueue_scripts() {
    // Get paths for cache-busting
    $css_path = get_template_directory() . '/app.css';
    $js_path = get_template_directory() . '/app.js';
    $css_version = file_exists($css_path) ? filemtime($css_path) : '1.0.0';
    $js_version = file_exists($js_path) ? filemtime($js_path) : '1.0.0';

    // Enqueue the React CSS
    wp_enqueue_style(
        'omegle-wp-style', 
        get_template_directory_uri() . '/app.css', 
        array(), 
        $css_version
    );
    
    // Enqueue the React JS
    wp_enqueue_script(
        'omegle-wp-script', 
        get_template_directory_uri() . '/app.js', 
        array(), 
        $js_version, 
        true
    );
    
    // Pass the backend URL to the JS app via wp_localize_script
    // This allows the frontend to know where the Node.js backend is running.
    wp_localize_script('omegle-wp-script', 'omegleWpSettings', array(
        'backendUrl' => 'http://localhost:3001',
        'homeUrl' => home_url()
    ));
}
add_action('wp_enqueue_scripts', 'omegle_wp_enqueue_scripts');
