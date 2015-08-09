/*
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

/*jslint browser: true */
/*global $: false, chrome: false, ga_report_event: false */

function set_i18n_text() {
    "use strict";
    var get_msg = chrome.i18n.getMessage;

    $('div#mode_select strong').html(get_msg('mode_select'));

    $('span.mode_offline_name').html(get_msg('mode_offline'));
    $('span.mode_offline_desc').html(get_msg('mode_offline_description'));
    $('span.mode_online_name').html(get_msg('mode_online'));
    $('span.mode_online_desc').html(get_msg('mode_online_description'));
    $('span.mode_unguarded_name').html(get_msg('mode_unguarded'));
    $('span.mode_unguarded_desc').html(get_msg('mode_unguarded_description'));

    $('div#help_text').html(get_msg('help'));
    $('div#feedback').html(get_msg('feedback'));
    $('div#rating').html(get_msg('rating'));
    $('span#sharing_text').html(get_msg('sharing'));
    
    $('div#support_title strong').html(get_msg('support_title'));
    $('span#support_checkbox_label').html(get_msg('support_checkbox_label'));
}

$(document).ready(function() {
    "use strict";
    set_i18n_text();

    var background = chrome.extension.getBackgroundPage();

    // set default button display
    background.getModeName(function(current_mode_name) {
        switch (current_mode_name) {
            case 'offline':
                $('label#offline').addClass('active');
                break;
            case 'unguarded':
                $('label#unguarded').addClass('active');
                break;
            default:
                $('label#online').addClass('active');
                break;
        }
    });

    // button actions
    $('input#input_offline').change(function() {
        console.log('to change mode to offline');
        background.changeMode('offline');
    });
    $('input#input_online').change(function() {
        console.log('to change mode to online');
        background.changeMode('online');
    });
    $('input#input_unguarded').change(function() {
        console.log('to change mode to unguarded');
        background.changeMode('unguarded');
    });
});

