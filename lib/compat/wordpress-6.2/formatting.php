<?php
/**
 * New WordPress Formatting API.
 *
 * @package gutenberg
 */

/**
 * Count words or characters in a provided text string.
 *
 * @since 6.2.0
 *
 * @param string $text  Text to count elements in.
 * @param string $type The type of count. Accepts 'words', 'characters_excluding_spaces', or 'characters_including_spaces'.
 * @param array  $settings {
 *     Optional. Array of arguments used to overrides for settings.
 *
 *     @type string $html_regexp                        Optional. Regular expression to find HTML elements.
 *     @type string $html_comment_regexp                Optional. Regular expression to find HTML comments.
 *     @type string $space_regexp                       Optional. Regular expression to find irregular space
 *                                                      characters.
 *     @type string $html_entity_regexp                 Optional. Regular expression to find HTML entities.
 *     @type string $connector_regexp                   Optional. Regular expression to find connectors that
 *                                                      split words.
 *     @type string $remove_regexp                      Optional. Regular expression to find remove unwanted
 *                                                      characters to reduce false-positives.
 *     @type string $astral_regexp                      Optional. Regular expression to find unwanted
 *                                                      characters when searching for non-words.
 *     @type string $words_regexp                       Optional. Regular expression to find words by spaces.
 *     @type string $characters_excluding_spaces_regexp Optional. Regular expression to find characters which
 *                                                      are non-spaces.
 *     @type string $characters_including_spaces_regexp Optional. Regular expression to find characters
 *                                                      including spaces.
 *     @type string $shortcodes_regexp                  Optional. Regular expression to find shortcodes.
 *     @type array  $shortcodes                         Optional. Array of shortcodes that should be removed
 *                                                      from the text.
 * }
 * @return int The word or character count.
 */
function gutenberg_word_count( $text, $type, $settings = array() ) {
	$defaults = array(
		'html_regexp'                        => '/<\/?[a-z][^>]*?>/i',
		'html_comment_regexp'                => '/<!--[\s\S]*?-->/',
		'space_regexp'                       => '/&nbsp;|&#160;/i',
		'html_entity_regexp'                 => '/&\S+?;/',
		'connector_regexp'                   => "/--|\x{2014}/u",
		'remove_regexp'                      => "/[\x{0021}-\x{0040}\x{005B}-\x{0060}\x{007B}-\x{007E}\x{0080}-\x{00BF}\x{00D7}\x{00F7}\x{2000}-\x{2BFF}\x{2E00}-\x{2E7F}]/u",
		'astral_regexp'                      => "/[\x{D800}-\x{DBFF}][\x{DC00}-\x{DFFF}]/u",
		'words_regexp'                       => '/\S\s+/',
		'characters_excluding_spaces_regexp' => '/\S/',
		'characters_including_spaces_regexp' => "/[^\f\n\r\t\v\x{00AD}\x{2028}\x{2029}]/u",
	);

	$count = 0;

	if ( ! $text ) {
		return $count;
	}

	$settings = wp_parse_args( $settings, $defaults );

	// If there are any shortcodes, add this as a shortcode regular expression.
	if ( isset( $settings['shortcodes'] ) && is_array( $settings['shortcodes'] ) ) {
		$settings['shortcodes_regexp'] = '\\[\\/?(?:' . implode( '|', $settings['shortcodes'] ) . ')[^\\]]*?\\]';
	}

	// Sanitize type to one of three possibilities: 'words', 'characters_excluding_spaces' or 'characters_including_spaces'.
	if ( 'characters_excluding_spaces' !== $type && 'characters_including_spaces' !== $type ) {
		$type = 'words';
	}

	$text .= "\n";

	// Replace all HTML with a new-line.
	$text = preg_replace( $settings['html_regexp'], "\n", $text );

	// Remove all HTML comments.
	$text = preg_replace( $settings['html_comment_regexp'], '', $text );

	// If a shortcode regular expression has been provided use it to remove shortcodes.
	if ( ! empty( $settings['shortcodes_regexp'] ) ) {
		$text = preg_replace( $settings['shortcodes_regexp'], "\n", $text );
	}

	// Normalize non-breaking space to a normal space.
	$text = preg_replace( $settings['space_regexp'], ' ', $text );

	if ( 'words' === $type ) {

		// Remove HTML Entities.
		$text = preg_replace( $settings['html_entity_regexp'], '', $text );

		// Convert connectors to spaces to count attached text as words.
		$text = preg_replace( $settings['connector_regexp'], ' ', $text );

		// Remove unwanted characters.
		$text = preg_replace( $settings['remove_regexp'], '', $text );
	} else {

		// Convert HTML Entities to "a".
		$text = preg_replace( $settings['html_entity_regexp'], 'a', $text );

		// Remove surrogate points.
		$text = preg_replace( $settings['astral_regexp'], 'a', $text );
	}

	// Match with the selected type regular expression to count the items.
	preg_match_all( $settings[ $type . '_regexp' ], $text, $matches );

	if ( $matches ) {
		return count( $matches[0] );
	}

	return $count;
}