<?php
/**
 * The main template file
 */
?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
    <meta charset="<?php bloginfo( 'charset' ); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <?php wp_head(); ?>
    <style>
        /* Basic reset to ensure React app takes full height without WP admin bar interference if logged out */
        body { margin: 0; padding: 0; min-height: 100vh; background-color: #18181b; color: white; }
    </style>
</head>
<body <?php body_class(); ?>>
    
    <!-- React App Container -->
    <div id="root"></div>

    <!-- Pass variables to window before React script loads -->
    <script>
        window.BACKEND_URL = typeof omegleWpSettings !== 'undefined' ? omegleWpSettings.backendUrl : "http://localhost:3001";
    </script>
    
    <?php wp_footer(); ?>
</body>
</html>
