(function( glob, undefined ) {

var rnumber = /[0-9]/,
	rnewline = /(\r\n|\r|\n)/,
	revidence = /\r\n|\r|\n/,
	rwhitespace = /(\s|\t)/,
	rvalidsolidus = /\\("|\\|\/|b|f|n|r|t|u[0-9]{4})/,
	rE = /^(\-|\+)?[0-9]/;


function isDigit(c) {
	return rnumber.exec(c);
}

function matches(c, charOrPredicate) {
	if (typeof charOrPredicate === "string")
		return c === charOrPredicate;
	return charOrPredicate(c);
}

// Leeeeeeerrrrroooyy Jennkkkiiinnnss
function JSONLint( json, options ) {
	var self = this;

	if ( ! ( self instanceof JSONLint ) ) {
		return new JSONLint( json, options );
	}

	// Argument handling
	self.json = json || '';
	self.options = options || {};
	self.lower = self.json.toLowerCase();

	// Allow comments by default
	if ( ! self.options.hasOwnProperty( 'comments' ) ) {
		self.options.comments = true;
	}

	// Internals
	self.c = '';
	self.i = -1;
	self.length = self.json.length;
	self.line = 1;
	self.character = 0;
	self._evidence = self.json.split( revidence );
	self.endblock = '';
	self.commabreak = false;

	try {
		self.render();
	} catch ( e ) {
		if ( typeof e != 'string' ) {
			throw e;
		}
		self.error = e;
		self.setEvidence();
	}
}


// Meta (Please change contact info for republishing with changes)
JSONLint.contact = "Corey Hart (corey@codenothing.com)";
JSONLint.version = '0.1.1';


// Methods
JSONLint.prototype = {

	// Rendering Start
	render: function(){
		var self = this, peek = '', content = false;

		for ( ; ++self.i < self.length; ) {
			self.c = self.json[ self.i ];
			self.character++;

			if ( self.options.comments && self.c == '/' ) {
				peek = self.json[ self.i + 1 ];
				if ( peek == '*' ) {
					self.multicomment();
				}
				else if ( peek == '/' ) {
					self.comment();
				}
				else {
					throw "Unknown character '/', maybe a comment?";
				}
			}
			else if ( rnewline.exec( self.c ) ) {
				self.line++;
				self.character = 0;
			}
			else if ( rwhitespace.exec( self.c ) ) {
				continue;
			}
			else if ( content ) {
				throw "Unknown character '" + self.c + "', expecting end of file.";
			}
			else if ( self.c == '[' ) {
				content = true;
				self.array();
			}
			else if ( self.c == '{' ) {
				content = true;
				self.object();
			}
			else {
				throw "Unknown character '" + self.c + "', expecting opening block '{' or '[', or maybe a comment";
			}
		}

		// Check for pure whitespace
		if ( ! content ) {
			throw "Invalid JSON, no content.";
		}
	},

	// Multi line comment
	multicomment: function(){
		var self = this;

		for ( ; ++self.i < self.length; ) {
			self.c = self.json[ self.i ];
			self.character++;

			if ( self.c == "*" && self.json[ self.i + 1 ] == "/" ) {
				self.i++;
				self.character++;
				break;
			}
			else if ( rnewline.exec( self.c ) ) {
				self.line++;
				self.character = 0;
			}
		}
	},

	// Single line comment
	comment: function(){
		var self = this;

		for ( ; ++self.i < self.length; ) {
			self.c = self.json[ self.i ];
			self.character++;

			if ( rnewline.exec( self.c ) ) {
				self.line++;
				self.character = 0;
				break;
			}
		}
	},

	// Array Block
	array: function(){
		// Keep reference of current endblock
		var self = this,
			_endblock = self.endblock,
			_commabreak = self.commabreak,
			ended = false;

		self.endblock = ']';
		self.commabreak = false;
		while ( ( ended = self.value() ) !== true && self.i < self.length ) {
			// Do nothing, just wait for array values to finish
		}

		if ( ! ended ) {
			throw "EOF Error. Expecting closing ']'";
		}

		// Reset previous endblock
		self.endblock = _endblock;
		self.commabreak = _commabreak;
	},

	// Object Block
	object: function(){
		// Keep reference of current endblock
		var self = this,
			_endblock = self.endblock,
			_commabreak = self.commabreak,
			found = false, peek = '', empty = true;

		self.endblock = '}';
		self.commabreak = false;
		for ( ; ++self.i < self.length; ) {
			self.c = self.json[ self.i ];
			self.character++;

			if ( self.options.comments && self.c == '/' ) {
				peek = self.json[ self.i + 1 ];
				if ( peek == '*' ) {
					self.multicomment();
				}
				else if ( peek == '/' ) {
					self.comment();
				}
				else {
					throw "Unknown character '/', maybe a comment?";
				}
			}
			else if ( rnewline.exec( self.c ) ) {
				self.line++;
				self.character = 0;
			}
			else if ( rwhitespace.exec( self.c ) ) {
				continue;
			}
			else if ( self.c == '"' ) {
				empty = false;
				if ( self.key() === true ) {
					// Reset old endblock
					self.endblock = _endblock;
					self.commabreak = _commabreak;
					found = true;
					break;
				}
			}
			else if ( empty && self.c == '}' ) {
				self.endblock = _endblock;
				self.commabreak = _commabreak;
				found = true;
				break;
			}
			else {
				throw "Unknown Character '" + self.c + "', expecting a string for key statement.";
			}
		}

		if ( ! found ) {
			throw "EOF Error, expecting closing '}'.";
		}
	},

	// Key Statement
	key: function(){
		var self = this;
		self.string();

		for ( var peek = ''; ++self.i < self.length; ) {
			self.c = self.json[ self.i ];
			self.character++;

			if ( self.options.comments && self.c == '/' ) {
				peek = self.json[ self.i + 1 ];
				if ( peek == '*' ) {
					self.multicomment();
				}
				else if ( peek == '/' ) {
					self.comment();
				}
				else {
					throw "Unknown character '/', maybe a comment?";
				}
			}
			else if ( rnewline.exec( self.c ) ) {
				self.line++;
				self.character = 0;
			}
			else if ( rwhitespace.exec( self.c ) ) {
				continue;
			}
			else if ( self.c == ":" ) {
				return self.value();
			}
			else {
				throw "Unknown Character '" + self.c + "', expecting a semicolon.";
			}
		}
	},

	// Value statement
	value: function(){
		var self = this, peek = '';

		for ( ; ++self.i < self.length; ) {
			self.c = self.json[ self.i ];
			self.character++;

			if ( self.options.comments && self.c == '/' ) {
				peek = self.json[ self.i + 1 ];
				if ( peek == '*' ) {
					self.multicomment();
				}
				else if ( peek == '/' ) {
					self.comment();
				}
				else {
					throw "Unknown character '/', maybe a comment?";
				}
			}
			else if ( rnewline.exec( self.c ) ) {
				self.line++;
				self.character = 0;
			}
			else if ( rwhitespace.exec( self.c ) ) {
				continue;
			}
			else if ( self.c == '{' ) {
				self.object();
				return self.endval();
			}
			else if ( self.c == '[' ) {
				self.array();
				return self.endval();
			}
			else if ( self.c == '"' ) {
				self.string();
				return self.endval();
			}
			else if ( self.json.indexOf( 'true', self.i ) === self.i ) {
				self.i += 3;
				self.character += 3;
				return self.endval();
			}
			else if ( self.json.indexOf( 'false', self.i ) === self.i ) {
				self.i += 4;
				self.character += 4;
				return self.endval();
			}
			else if ( self.json.indexOf( 'null', self.i ) === self.i ) {
				self.i += 3;
				self.character += 3;
				return self.endval();
			}
			else if ( self.c == '-' || rnumber.exec( self.c ) ) {
				return self.numeric();
			}
			else if ( self.c == ']' && self.endblock == ']' ) {
				if ( self.commabreak ) {
					throw "Unexpected End Of Array Error. Expecting a value statement.";
				}
				return true;
			}
			else {
				throw "Unknown Character '" + self.c + "', expecting a value.";
			}
		}
	},

	// String statement
	string: function(){
		var self = this, found = false, m;

		for ( ; ++self.i < self.length; ) {
			self.c = self.json[ self.i ];
			self.character++;

			if ( self.c == "\\" ) {
				if ( ( m = rvalidsolidus.exec( self.json.substr( self.i ) ) ) && m.index === 0 ) {
					self.i += m[ 1 ].length;
					self.character += m[ 1 ].length;
				}
				else {
					throw "Invalid Reverse Solidus '\\' declaration.";
				}
			}
			else if ( rnewline.exec( self.c ) ) {
				self.line++;
				self.character = 0;
			}
			else if ( self.c == '"' ) {
				found = true;
				break;
			}
		}

		// Make sure close string is found
		if ( ! found ) {
			throw "EOF: No close string '\"' found.";
		}
	},

	atEnd: function() {
		return this.i >= this.length;
	},

	errorIfAtEnd: function(eofErr) {
		if (this.atEnd())
			throw "Unexpected end - " + eofErr + ".";
	},

	lookahead: function(eofErr) {
		this.errorIfAtEnd(eofErr);
		return this.json[this.i];
	},

	lookingAt: function(c) {
		return !this.atEnd() && matches(this.lookahead(), c);
	},

	advance: function(eofErr) {
		this.c = this.lookahead(eofErr);
		if (rnewline.exec(this.c)) {
			this.line++;
			this.character = 0;
		} else {
			this.i++;
			this.character++;
		}
	},

	consumeOne: function(c, err) {
		this.errorIfAtEnd(err);
		if (!this.lookingAt(c)) {
			this.i--;
			this.character--;	
			throw "Invalid character '" + this.lookahead() + "' - " + err + ".";
		}
		this.advance();
	},

	consumeOptional: function(c) {
		if (this.lookingAt(c)) {
			this.advance();
			return true;
		}
		return false;
	},

	consumeZeroOrMore: function(f) {
		while (this.lookingAt(f))
			this.advance();
	},

	consumeOneOrMore: function(f, err) {
		this.consumeOne(f, err);
		this.consumeZeroOrMore(f);
	},

	// Numeric Value
	numeric: function(){
		this.consumeOptional("-");
		this.consumeOne(isDigit, "digit expected in number");
		if (this.c !== "0")
			this.consumeZeroOrMore(isDigit);
		if (this.consumeOptional("."))
			this.consumeOneOrMore(isDigit, "digit expected after decimal point");
		if (this.consumeOptional(function (c) { return c === "e" || c === "E"; })) {
			this.consumeOptional(function (c) { return c === "+" || c === "-"; });
			this.consumeOneOrMore(isDigit, "digit expected in exponent");
		}

		this.i--;
		this.character--;
		return this.endval();
	},

	// Ending a value statement
	endval: function(){
		var self = this, peek = '';
		self.commabreak = false;

		for ( ; ++self.i < self.length; ) {
			self.c = self.json[ self.i ];
			self.character++;

			if ( self.options.comments && self.c == '/' ) {
				peek = self.json[ self.i + 1 ];
				if ( peek == '*' ) {
					self.multicomment();
				}
				else if ( peek == '/' ) {
					self.comment();
				}
				else {
					throw "Unknown character '/', maybe a comment?";
				}
			}
			else if ( rnewline.exec( self.c ) ) {
				self.line++;
				self.character = 0;
			}
			else if ( rwhitespace.exec( self.c ) ) {
				continue;
			}
			else if ( self.c == ',' ) {
				self.commabreak = true;
				break;
			}
			else if ( self.c == self.endblock ) {
				return true;
			}
			else {
				throw "Unknown Character '" + self.c + "', expecting a comma or a closing '" + self.endblock + "'";
			}
		}
	},

	// Expose line of the error
	setEvidence: function(){
		var self = this, start = self.line - 5, end = start + 8, evidence = '';

		// Min start
		if ( start < 0 ) {
			start = 0;
			end = 8;
		}

		// Max end
		if ( end >= self._evidence.length ) {
			end = self._evidence.length;
		}

		// Evidence display
		for ( ; start < end; start++ ) {
			evidence += ( start === ( self.line - 1 ) ? "-> " : "   " ) +
				( start + 1 ) + '| ' +
				self._evidence[ start ] + "\n";
		}

		// Set the evidence display
		self.evidence = evidence;
	}
};


// Check for nodejs module system
if ( typeof exports == 'object' && typeof module == 'object' ) {
	module.exports = JSONLint;
}
// In a browser
else {
	glob.JSONLint = JSONLint;
}

})( this );
